package service

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/lejianwen/rustdesk-api/v2/config"
)

// setupGithubMembershipMock 启动一个模拟 GitHub /user/memberships/orgs/{org} 接口的服务，
// memberships 为 org -> state 映射（不存在返回 404）。返回测试服务器地址。
func setupGithubMembershipMock(t *testing.T, memberships map[string]string) string {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("/user/memberships/orgs/", func(w http.ResponseWriter, r *http.Request) {
		org := strings.TrimPrefix(r.URL.Path, "/user/memberships/orgs/")
		state, ok := memberships[org]
		if !ok {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		fmt.Fprintf(w, `{"state":%q}`, state)
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	oldFmt := githubMembershipURLFmt
	githubMembershipURLFmt = srv.URL + "/user/memberships/orgs/%s"
	t.Cleanup(func() { githubMembershipURLFmt = oldFmt })
	return srv.URL
}

func TestCheckGithubAccessDisabledWhenNoUsersConfigured(t *testing.T) {
	Config = &config.Config{GithubOauth: config.GithubOauthAccess{
		RestrictEnable: false,
		Orgs:           "",
		Users:          "",
	}}
	os := &OauthService{}
	if err := os.checkGithubAccess(http.DefaultClient, "anyone"); err != nil {
		t.Fatalf("no restriction should allow anyone, got %v", err)
	}
}

func TestCheckGithubAccessEnvAllowedUsers(t *testing.T) {
	// 验证通过环境变量 ALLOWED_USERS 控制可登录的用户名
	t.Setenv("ALLOWED_USERS", "devcxl, Alice")
	Config = &config.Config{GithubOauth: config.GithubOauthAccess{
		RestrictEnable: false,
		Users:          "",
	}}
	os := &OauthService{}

	if err := os.checkGithubAccess(http.DefaultClient, "devcxl"); err != nil {
		t.Fatalf("devcxl should pass via ALLOWED_USERS, got %v", err)
	}
	if err := os.checkGithubAccess(http.DefaultClient, "alice"); err != nil {
		t.Fatalf("alice should pass case-insensitively, got %v", err)
	}
	if err := os.checkGithubAccess(http.DefaultClient, "mallory"); err == nil {
		t.Fatal("mallory should be denied when ALLOWED_USERS is set")
	}
}

func TestCheckGithubAccessAllowedByUser(t *testing.T) {
	setupGithubMembershipMock(t, nil)
	Config = &config.Config{GithubOauth: config.GithubOauthAccess{
		RestrictEnable: true,
		Orgs:           "",
		Users:          "Alice, bob",
	}}
	os := &OauthService{}
	// 大小写不敏感
	if err := os.checkGithubAccess(http.DefaultClient, "alice"); err != nil {
		t.Fatalf("whitelisted user alice should pass, got %v", err)
	}
	if err := os.checkGithubAccess(http.DefaultClient, "BOB"); err != nil {
		t.Fatalf("whitelisted user BOB should pass, got %v", err)
	}
	if err := os.checkGithubAccess(http.DefaultClient, "stranger"); err == nil {
		t.Fatal("stranger should be denied")
	}
}

func TestCheckGithubAccessAllowedByAdmins(t *testing.T) {
	setupGithubMembershipMock(t, nil)
	Config = &config.Config{GithubOauth: config.GithubOauthAccess{
		RestrictEnable: true,
		Orgs:           "",
		Users:          "",
		Admins:         "devcxl, ops-team",
	}}
	os := &OauthService{}
	if err := os.checkGithubAccess(http.DefaultClient, "devcxl"); err != nil {
		t.Fatalf("admin devcxl should pass without orgs/users, got %v", err)
	}
	if err := os.checkGithubAccess(http.DefaultClient, "OPS-TEAM"); err != nil {
		t.Fatalf("admin OPS-TEAM should pass (case-insensitive), got %v", err)
	}
	if err := os.checkGithubAccess(http.DefaultClient, "mallory"); err == nil {
		t.Fatal("non-admin mallory should still be denied")
	}
}

func TestCheckGithubAccessAllowedByOrgMember(t *testing.T) {
	setupGithubMembershipMock(t, map[string]string{"acme": "active", "subsidiary": "pending"})
	Config = &config.Config{GithubOauth: config.GithubOauthAccess{
		RestrictEnable: true,
		Orgs:           "acme,subsidiary",
		Users:          "",
	}}
	os := &OauthService{}
	if err := os.checkGithubAccess(http.DefaultClient, "someone"); err != nil {
		t.Fatalf("active member of acme should pass, got %v", err)
	}
}

func TestCheckGithubAccessDeniedForPendingOrNonMember(t *testing.T) {
	setupGithubMembershipMock(t, map[string]string{"acme": "pending"})
	Config = &config.Config{GithubOauth: config.GithubOauthAccess{
		RestrictEnable: true,
		Orgs:           "acme",
		Users:          "alice",
	}}
	os := &OauthService{}
	if err := os.checkGithubAccess(http.DefaultClient, "mallory"); err == nil {
		t.Fatal("non-member mallory should be denied")
	}
}

func TestCheckGithubAccessFailClosedOnServerError(t *testing.T) {
	oldFmt := githubMembershipURLFmt
	githubMembershipURLFmt = "http://127.0.0.1:1/user/memberships/orgs/%s"
	t.Cleanup(func() { githubMembershipURLFmt = oldFmt })

	Config = &config.Config{GithubOauth: config.GithubOauthAccess{
		RestrictEnable: true,
		Orgs:           "acme",
		Users:          "",
	}}
	os := &OauthService{}
	client := &http.Client{}
	if err := os.checkGithubAccess(client, "someone"); err == nil {
		t.Fatal("should deny when github api unreachable (fail-closed)")
	}
}

func TestIsAdminListed(t *testing.T) {
	cases := []struct {
		csv, login string
		want       bool
	}{
		{"alice,bob", "alice", true},
		{"alice,bob", "ALICE", true},
		{" alice , bob ", "bob", true},
		{"alice", "mallory", false},
		{"", "alice", false},
		{"  ", "alice", false},
	}
	for _, c := range cases {
		if got := isAdminListed(c.csv, c.login); got != c.want {
			t.Errorf("isAdminListed(%q, %q) = %v, want %v", c.csv, c.login, got, c.want)
		}
	}
}

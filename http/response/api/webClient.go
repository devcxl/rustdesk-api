package api

import (
	"time"

	"github.com/lejianwen/rustdesk-api/v2/model"
)

type WebClientPeerPayload struct {
	ViewStyle string                   `json:"view-style"`
	Tm        int64                    `json:"tm"`
	Info      WebClientPeerInfoPayload `json:"info"`
	Tmppwd    string                   `json:"tmppwd"`
}

type WebClientPeerInfoPayload struct {
	Username string `json:"username"`
	Hostname string `json:"hostname"`
	Platform string `json:"platform"`
	Hash     string `json:"hash"`
	Id       string `json:"id"`
}

func (wcpp *WebClientPeerPayload) FromAddressBook(a *model.AddressBook) {
	wcpp.ViewStyle = "shrink"
	wcpp.Tm = time.Now().Add(-time.Hour * 24).UnixNano()
	wcpp.Info = WebClientPeerInfoPayload{
		Username: a.Username,
		Hostname: a.Hostname,
		Platform: a.Platform,
		Hash:     a.Hash,
	}
}

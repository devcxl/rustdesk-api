package api

type AuditConnForm struct {
	Action    string   `json:"action"`
	ConnId    int64    `json:"conn_id"`
	Id        string   `json:"id"`
	Peer      []string `json:"peer"`
	Ip        string   `json:"ip"`
	SessionId float64  `json:"session_id"`
	Type      int      `json:"type"`
	Uuid      string   `json:"uuid"`
}

type AuditFileForm struct {
	Id     string `json:"id"`
	Info   string `json:"info"`
	IsFile bool   `json:"is_file"`
	Path   string `json:"path"`
	PeerId string `json:"peer_id"`
	Type   int    `json:"type"`
	Uuid   string `json:"uuid"`
}

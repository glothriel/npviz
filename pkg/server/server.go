package server

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/glothriel/npviz/pkg/extractor"
	"github.com/gobuffalo/packr"
	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
)

// NpvizServer is a HTTP server responsible for communication with Web UI and serving static files for the very same UI
type NpvizServer struct {
	backend extractor.Extractor
	router  *mux.Router
}

func (bs *NpvizServer) redirectToForm(w http.ResponseWriter, r *http.Request) {
	http.Redirect(w, r, "/ui/index.html", 301)
}

func (bs *NpvizServer) formBackendHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		loadedJSON, loadJSONErr := bs.backend.Extract()
		if loadJSONErr != nil {
			logrus.Error(loadJSONErr)
			http.Error(w, "Could not load yaml definitions", http.StatusInternalServerError)
			return
		}
		jsonString, marshalErr := json.Marshal(loadedJSON)
		if marshalErr != nil {
			logrus.Error(marshalErr)
			http.Error(w, "Could not encode yaml definitions to JSON object", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		if _, writeErr := w.Write(jsonString); writeErr != nil {
			logrus.Error(writeErr)
		}
	}
}

// Listen starts the HTTP server
func (bs *NpvizServer) Listen(port uint) {
	http.Handle("/", bs.router)
	serverAddr := fmt.Sprintf("0.0.0.0:%d", port)
	logrus.Info(fmt.Sprintf("Starting HTTP server at %s", serverAddr))
	logrus.Info(http.ListenAndServe(serverAddr, bs.router))
}

// NewServer creates server and configures its routes
func NewServer(
	extractor extractor.Extractor,
) (*NpvizServer, error) {
	theServer := &NpvizServer{
		backend: extractor,
		router:  mux.NewRouter(),
	}
	theServer.router.HandleFunc("/", theServer.redirectToForm)
	theServer.router.HandleFunc("/resources", theServer.formBackendHandler)
	theServer.router.PathPrefix("/ui/").Handler(
		Cachebuster(http.StripPrefix("/ui/", http.FileServer(packr.NewBox("./templates")))),
	)

	return theServer, nil
}

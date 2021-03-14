package main

import (
	"github.com/glothriel/npviz/pkg/extractor"
	"github.com/glothriel/npviz/pkg/server"
	"github.com/sirupsen/logrus"
)

func main() {
	logrus.SetLevel(logrus.InfoLevel)
	extractor := extractor.NewFilesystemResourceExtractor("/home/kosto/Projects/promil/Promil-infra-staging/kubernetes")
	// extractor := extractor.NewClusterResourceExtractor()
	server, err := server.NewServer(extractor)
	if err != nil {
		logrus.Fatal(err)
	}
	server.Listen(1337)
}

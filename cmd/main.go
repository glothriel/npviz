package main

import (
	"log"
	"os"

	"github.com/glothriel/npviz/pkg/extractor"
	"github.com/glothriel/npviz/pkg/server"
	"github.com/sirupsen/logrus"
	"github.com/urfave/cli/v2"
)

func main() {

	app := &cli.App{
		Name:  "npviz",
		Usage: "npviz aka NetworkPolicy visualizer draws graphs of kubernetes workload connections",
		Commands: []*cli.Command{
			{
				Name:  "server",
				Usage: "Run server that allows interactively debug your workload connections",
				Flags: []cli.Flag{
					&cli.UintFlag{
						Name:  "port",
						Value: 1337,
						Usage: "Port the server should listen on",
					},
					&cli.StringFlag{
						Name:  "from-directory",
						Value: "",
						Usage: "Instead of connecting to the cluster, recursively scan local directory and extract all templates from there",
					},
				},
				Action: func(c *cli.Context) error {
					var theExtractor extractor.Extractor
					if c.String("from-directory") == "" {
						theExtractor = extractor.NewClusterResourceExtractor()
					} else {
						theExtractor = extractor.NewFilesystemResourceExtractor(
							c.String("from-directory"),
						)
					}
					server, err := server.NewServer(theExtractor)
					if err != nil {
						logrus.Fatal(err)
					}
					server.Listen(c.Uint("port"))
					return nil
				},
			},
		},
		Version: "0.0.3",
		Before:  setLogLevel,
		Flags: []cli.Flag{
			&cli.BoolFlag{
				Name:  "debug",
				Usage: "Be more verbose when logging stuff",
			},
		},
	}
	err := app.Run(os.Args)
	if err != nil {
		log.Fatal(err)
	}
}

func setLogLevel(c *cli.Context) error {
	if c.IsSet("debug") {
		logrus.SetLevel(logrus.DebugLevel)
	} else {
		logrus.SetLevel(logrus.InfoLevel)
	}
	return nil
}

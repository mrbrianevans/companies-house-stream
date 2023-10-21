
# copies the built client files into the docker container to be served by the webserver
docker compose cp ./client-pure/dist/. webserver:/client/.

 # Deployment instructions
 
This service is deployed using Docker Compose on a Digital Ocean droplet.

The droplet has a local copy of the Git repo, connected to GitHub with a HTTPS git remote.

To perform a deploy, ssh into the Droplet, and run `git pull` and then `docker compose up -d --build <service>` to rebuild and restart a service.


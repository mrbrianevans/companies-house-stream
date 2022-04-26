resource "digitalocean_project" "companies-stream" {
  name        = "companies-stream"
  description = "Companies House event streaming web app."
  environment = "Production"
  resources   = [digitalocean_droplet.event-listener.urn]
}

data "template_file" "user_data" {
  template = file("./docker-node.yaml")
}
resource "digitalocean_droplet" "event-listener" {
  image    = "ubuntu-20-04-x64"
  name     = "event-listener"
  region   = "lon1"
  size     = "s-1vcpu-1gb"
  ssh_keys = [
    data.digitalocean_ssh_key.terraform.id
  ]
  connection {
    host        = self.ipv4_address
    user        = "root"
    type        = "ssh"
    private_key = file(var.pvt_key)
    timeout     = "2m"
  }
  user_data  = data.template_file.user_data.rendered
  tags       = ["terraform"]
  monitoring = true
}

resource "digitalocean_container_registry" "stream-images" {
  name                   = "stream-images"
  subscription_tier_slug = "starter"
  region                 = "ams3"
}
resource "digitalocean_container_registry_docker_credentials" "stream-images" {
  registry_name = "stream-images"
}
provider "docker" {
  host = "tcp://localhost:2375"

  registry_auth {
    address             = digitalocean_container_registry.stream-images.server_url
    config_file_content = digitalocean_container_registry_docker_credentials.stream-images.docker_credentials
  }
}
# build a docker image and push it to the newly created registry
resource "docker_registry_image" "event-listener" {
  name = "registry.digitalocean.com/stream-images/event-listener:latest"
  build {
    auth_config {
      host_name = "registry.digitalocean.com"
    }
    context = "..\\server"
  }
}

resource "digitalocean_project" "companies-stream" {
  name        = "companies-stream"
  description = "Companies House event streaming web app."
  environment = "Production"
  resources   = [digitalocean_droplet.event-listener.urn, digitalocean_droplet.pubsub.urn]
}
resource "digitalocean_vpc" "events" {
  name        = "events-network"
  description = "Private networking for streaming events with publisher/subscriber pattern"
  region      = "lon1"
}
resource "random_password" "redis_password" {
  length  = 256
  special = false
}
data "template_file" "docker-node" {
  template = file("./docker-node.yaml")
  vars     = {
    pubsub_redis_ip = digitalocean_droplet.pubsub.ipv4_address_private
    redis_password  = random_password.redis_password.result
  }
}
data "template_file" "redis-data" {
  template = file("./redis-data.yaml")
  vars     = {
    redis_password = random_password.redis_password.result
  }
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
  provisioner "remote-exec" {
    inline = [
      "mkdir -p /app/server/src"
    ]
  }
  provisioner "file" {
    source      = "../server/src/"
    destination = "/app/server/src"
  }
  provisioner "file" {
    source      = "../server/.dockerignore"
    destination = "/app/server/.dockerignore"
  }
  provisioner "file" {
    source      = "../.api.env"
    destination = "/app/.api.env"
  }
  provisioner "file" {
    source      = "../server/package.json"
    destination = "/app/server/package.json"
  }
  provisioner "file" {
    source      = "../server/package-lock.json"
    destination = "/app/server/package-lock.json"
  }
  provisioner "file" {
    source      = "../server/tsconfig.json"
    destination = "/app/server/tsconfig.json"
  }
  provisioner "file" {
    source      = "../server/Test.Dockerfile"
    destination = "/app/server/Test.Dockerfile"
  }
  provisioner "file" {
    source      = "../server/Dockerfile"
    destination = "/app/server/Dockerfile"
  }
  user_data  = data.template_file.docker-node.rendered
  tags       = ["terraform"]
  monitoring = true
  vpc_uuid   = digitalocean_vpc.events.id
}

resource "digitalocean_droplet" "pubsub" {
  image    = "ubuntu-20-04-x64"
  name     = "pubsub"
  region   = "lon1"
  size     = "s-1vcpu-1gb"
  ssh_keys = [
    data.digitalocean_ssh_key.terraform.id
  ]
  user_data  = data.template_file.redis-data.rendered
  tags       = ["terraform"]
  monitoring = true
  vpc_uuid   = digitalocean_vpc.events.id
}

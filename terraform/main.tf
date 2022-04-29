resource "digitalocean_project" "companies-stream" {
  name        = "companies-stream"
  description = "Companies House event streaming web app."
  environment = "Production"
  resources   = [
    digitalocean_droplet.event-listener.urn, digitalocean_droplet.pubsub.urn, digitalocean_droplet.event-subscriber.urn,
    digitalocean_loadbalancer.frontend.urn
  ]
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
data "template_file" "docker-node-pub" {
  template = file("./docker-node.yaml")
  vars     = {
    pubsub_redis_ip = digitalocean_droplet.pubsub.ipv4_address_private
    redis_password  = random_password.redis_password.result
    npm_command     = "stream-pub"
  }
}
data "template_file" "docker-node-sub" {
  template = file("./docker-node.yaml")
  vars     = {
    pubsub_redis_ip = digitalocean_droplet.pubsub.ipv4_address_private
    redis_password  = random_password.redis_password.result
    npm_command     = "stream-sub"
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
    source      = "../server/Dockerfile"
    destination = "/app/server/Dockerfile"
  }
  user_data  = data.template_file.docker-node-pub.rendered
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


resource "digitalocean_firewall" "redis" {
  name = "only-ssh-and-internal-redis"

  droplet_ids = [digitalocean_droplet.pubsub.id]

  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "6379"
    source_addresses = [digitalocean_vpc.events.ip_range]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "443"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "tcp"
    port_range            = "80"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "tcp"
    port_range            = "53" # dns
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}
resource "digitalocean_firewall" "only-ssh" {
  name = "only-ssh"

  droplet_ids = [digitalocean_droplet.event-listener.id]

  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0"]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "443"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "tcp"
    port_range            = "80"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "tcp"
    port_range            = "53" # dns
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}
resource "digitalocean_firewall" "web-server-only-lb" {
  name        = "web-server-only-lb"
  droplet_ids = [digitalocean_droplet.event-subscriber.id]
  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0"]
  }
  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = [digitalocean_vpc.events.ip_range]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "443"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "tcp"
    port_range            = "80"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "tcp"
    port_range            = "53" # dns
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}
resource "digitalocean_droplet" "event-subscriber" {
  image    = "ubuntu-20-04-x64"
  name     = "event-subscriber"
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
    source      = "../server/Dockerfile"
    destination = "/app/server/Dockerfile"
  }
  user_data  = data.template_file.docker-node-sub.rendered
  tags       = ["terraform", "public-web-server"]
  monitoring = true
  vpc_uuid   = digitalocean_vpc.events.id
}

data "digitalocean_certificate" "companiesStreamAutoCertificate" {
  name = "companiesStreamAutoCertificate"
}
resource "digitalocean_loadbalancer" "frontend" {
  name        = "frontend"
  region      = "lon1"
  droplet_tag = "public-web-server"
  vpc_uuid    = digitalocean_vpc.events.id
  forwarding_rule {
    entry_port       = 443
    entry_protocol   = "https"
    target_port      = 80
    target_protocol  = "http"
    certificate_name = data.digitalocean_certificate.companiesStreamAutoCertificate.name
  }
  forwarding_rule {
    entry_port      = 80
    entry_protocol  = "http"
    target_port     = 80
    target_protocol = "http"
  }
  redirect_http_to_https = true
  healthcheck {
    port     = 80
    protocol = "http"
    path     = "/health"
  }
  enable_proxy_protocol = true
}

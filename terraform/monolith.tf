resource "digitalocean_droplet" "monolith" {
  image    = "docker-20-04"
  name     = "monolith"
  region   = "lon1"
  size     = "s-1vcpu-1gb"
  ssh_keys = [
    data.digitalocean_ssh_key.terraform.id
  ]
  tags       = ["terraform"]
  monitoring = true
}

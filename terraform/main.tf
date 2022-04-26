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

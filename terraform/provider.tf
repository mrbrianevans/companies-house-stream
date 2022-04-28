terraform {
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "2.19.0"
    }
    docker = {
      source  = "kreuzwerker/docker"
      version = "2.16.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.0.1"
    }
  }
}

variable "do_token" {}
variable "pvt_key" {}

provider "digitalocean" {
  token = var.do_token
}

provider "random" {
}
data "digitalocean_ssh_key" "terraform" {
  name = "Brian"
}

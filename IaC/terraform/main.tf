terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

provider "docker" {}

resource "docker_network" "app" {
  name = "medicare_net"
}

resource "docker_volume" "mysql_data" {
  name = "mysql_data"
}

resource "docker_container" "mysql" {
  image   = "mysql:8.0"
  name    = "medicare-db-mysql"
  restart = "unless-stopped"

  env = [
    "MYSQL_ROOT_PASSWORD=1234",
    "MYSQL_DATABASE=telemedicinedb",
    "MYSQL_USER=root",
    "MYSQL_PASSWORD=1234"
  ]

  networks_advanced {
    name = docker_network.app.name
  }

  ports {
    internal = 3306
    external = 3308
  }

  mounts {
    target = "/var/lib/mysql"
    source = docker_volume.mysql_data.name
    type   = "volume"
  }
}

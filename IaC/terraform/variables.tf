variable "region" {
  default = "ap-southeast-1"
}

variable "project" {
  default = "medicare"
}

variable "DB_USER" {
  default = "root"
}

variable "DB_PASS" {
  default = "1234"
  sensitive = true
}

variable "DB_NAME" {
  default = "telemedicinedb"
}


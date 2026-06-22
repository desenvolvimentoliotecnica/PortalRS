"""Perfis de deploy SSH (build local no servidor, sem GitHub Actions / GHCR)."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class DeployEnvironment:
    id: str
    label: str
    branch: str
    default_host: str
    default_remote_dir: str
    default_api_url: str
    default_admin_url: str
    default_portal_vagas_url: str
    default_tenant: str
    compose_file: str
    env_file: str
    registry_prefix_var: str
    image_tag_var: str
    portal_vagas_url_var: str
    compose_env_file_var: str
    app_environment: str
    docker_network: str
    docker_network_subnet: str
    health_api_port: int
    container_api: str
    container_web: str
    container_portal_vagas: str
    container_ai: str

    @property
    def image_repos(self) -> tuple[str, ...]:
        return (
            "rhportal-api",
            "rhportal-web-next",
            "rhportal-portal-vagas",
            "rhportal-ai",
        )

    @property
    def containers(self) -> tuple[str, ...]:
        return (
            self.container_api,
            self.container_web,
            self.container_portal_vagas,
            self.container_ai,
        )

    def container_for_image(self, image_repo: str) -> str:
        mapping = {
            "rhportal-api": self.container_api,
            "rhportal-web-next": self.container_web,
            "rhportal-portal-vagas": self.container_portal_vagas,
            "rhportal-ai": self.container_ai,
        }
        return mapping[image_repo]


ENVIRONMENTS: dict[str, DeployEnvironment] = {
    "hmg": DeployEnvironment(
        id="hmg",
        label="HMG (10.0.0.80)",
        branch="portalRH-HML",
        default_host="10.0.0.80",
        default_remote_dir="/home/administrator/rh-deploys",
        default_api_url="http://10.0.0.80:5000",
        default_admin_url="http://10.0.0.80:3000",
        default_portal_vagas_url="http://10.0.0.80:3050",
        default_tenant="liotecnica",
        compose_file="docker-compose.hmg.yml",
        env_file="$HOME/.env.hmg",
        registry_prefix_var="HMG_REGISTRY_PREFIX",
        image_tag_var="HMG_IMAGE_TAG",
        portal_vagas_url_var="HMG_PORTAL_VAGAS_URL",
        compose_env_file_var="HMG_ENV_FILE",
        app_environment="HMG",
        docker_network="rhportal-net",
        docker_network_subnet="192.168.241.0/24",
        health_api_port=5000,
        container_api="rhportal-api",
        container_web="rhportal-web-next",
        container_portal_vagas="rhportal-portal-vagas",
        container_ai="rhportal-ai",
    ),
    "dev": DeployEnvironment(
        id="dev",
        label="DEV (10.0.0.79)",
        branch="portalRH-DEV",
        default_host="10.0.0.79",
        default_remote_dir="/home/administrator/rh-deploys-dev",
        default_api_url="http://10.0.0.79:5000",
        default_admin_url="http://10.0.0.79:3000",
        default_portal_vagas_url="http://10.0.0.79:3050",
        default_tenant="liotecnica",
        compose_file="docker-compose.portalrh-dev.yml",
        env_file="$HOME/.env.portalrh-dev",
        registry_prefix_var="DEV_REGISTRY_PREFIX",
        image_tag_var="DEV_IMAGE_TAG",
        portal_vagas_url_var="DEV_PORTAL_VAGAS_URL",
        compose_env_file_var="DEV_ENV_FILE",
        app_environment="DEV",
        docker_network="rhportal-net",
        docker_network_subnet="192.168.240.0/24",
        health_api_port=5000,
        container_api="rhportal-dev-api",
        container_web="rhportal-dev-web-next",
        container_portal_vagas="rhportal-dev-portal-vagas",
        container_ai="rhportal-dev-ai",
    ),
}

IMAGE_PREFIX = "ghcr.io/munizlmachado-jpg/rh"

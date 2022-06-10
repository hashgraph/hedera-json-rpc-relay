FROM mcr.microsoft.com/vscode/devcontainers/base:ubuntu-20.04

RUN export DEBIAN_FRONTEND=noninteractive \
	&& apt-get update \
	# required packages for adding new lists
	&& apt-get -y install --no-install-recommends \
		apt-transport-https ca-certificates dirmngr software-properties-common \
	# install packages
	&& apt-get update \
	&& apt-get -y install --no-install-recommends \
		# https://code.visualstudio.com/docs/remote/containers#_sharing-gpg-keys
		gnupg2 \
	&& rm -rf /var/lib/apt/lists/*
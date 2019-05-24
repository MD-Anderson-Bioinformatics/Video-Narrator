#!/bin/sh
# Docker image to use:
IMAGE=video-narrator

# Assumes this script is for personal use and not world
# readable.
# Define local directory containing authorization key:
AUTHDIR=replace with path to directory containing your key
# Define filename containing authorization key:
AUTHFILE=replace with file containing your key

USER=`id -u`:`id -g`
AUTH=GOOGLE_APPLICATION_CREDENTIALS=/auth/$AUTHFILE
docker run --rm --user $USER -v $AUTHDIR:/auth:ro -e $AUTH -v `pwd`:/scriptdir $IMAGE $*

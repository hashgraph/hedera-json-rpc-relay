#!/bin/bash

curl -Os https://uploader.codecov.io/latest/linux/codecov && chmod +x codecov

if [ -d "coverage" ]; then
  echo "Uploading coverage report for root"
  ./codecov --token "${CODECOV_TOKEN}" --fail-on-error
else
  echo "No coverage report found for root"
fi

for dir in packages/*; do
  if [ -d "${dir}/coverage" ]; then
    echo "Uploading coverage report for ${dir}"
    ./codecov --dir "${dir}" --flags "$(basename "${dir}")" --token "${CODECOV_TOKEN}" --fail-on-error
  else
    echo "No coverage report found for ${dir}"
  fi
done

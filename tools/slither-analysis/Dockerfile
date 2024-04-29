FROM trailofbits/eth-security-toolbox
RUN mkdir ~/tmp
COPY ./detectors/all_detectors.py /home/ethsec/tmp/
COPY ./detectors/hedera/ecrecover_usage_local.py /home/ethsec/tmp/
RUN mkdir ~/.local/lib/python3.10/site-packages/slither/detectors/hedera
RUN cd ~/.local/lib/python3.10/site-packages/slither/detectors/hedera && rm ../all_detectors.py && rm -rf ../__pycache__ && rm -rf __pycache__  && mv ~/tmp/ecrecover_usage_local.py ecrecover_usage_local.py && cd .. && mv ~/tmp/all_detectors.py all_detectors.py

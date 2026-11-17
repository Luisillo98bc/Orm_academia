FROM golang:1.24-alpine@sha256:8bee1901f1e530bfb4a7850aa7a479d17ae3a18beb6e09064ed54cfd245b7191 AS build

ARG MC_COMMIT=77f82e18b5401a65958f1619df6ebb994634bd88

RUN apk add --no-cache ca-certificates git
WORKDIR /src

RUN git init . \
  && git remote add origin https://github.com/minio/mc.git \
  && git fetch --depth 1 origin "${MC_COMMIT}" \
  && git checkout --detach FETCH_HEAD \
  && CGO_ENABLED=0 go build -trimpath -o /out/mc .

FROM alpine:3.22@sha256:2e0b81d60597f449baa56dc25d355367869d2dca4cd57e866f1e2b52af3eb55f

RUN apk add --no-cache ca-certificates
COPY --from=build /out/mc /usr/local/bin/mc

ENTRYPOINT ["/usr/local/bin/mc"]

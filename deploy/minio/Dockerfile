FROM golang:1.24-alpine@sha256:8bee1901f1e530bfb4a7850aa7a479d17ae3a18beb6e09064ed54cfd245b7191 AS build

ARG MINIO_COMMIT=7aac2a2c5b7c882e68c1ce017d8256be2feea27f

RUN apk add --no-cache ca-certificates git
WORKDIR /src

RUN git init . \
  && git remote add origin https://github.com/minio/minio.git \
  && git fetch --depth 1 origin "${MINIO_COMMIT}" \
  && git checkout --detach FETCH_HEAD \
  && CGO_ENABLED=0 go build -trimpath -o /out/minio .

FROM alpine:3.22@sha256:2e0b81d60597f449baa56dc25d355367869d2dca4cd57e866f1e2b52af3eb55f

RUN apk add --no-cache ca-certificates wget \
  && addgroup -S -g 10001 minio \
  && adduser -S -D -H -u 10001 -G minio minio

COPY --from=build /out/minio /usr/local/bin/minio

RUN mkdir -p /data && chown -R minio:minio /data
USER minio
WORKDIR /data
VOLUME ["/data"]
EXPOSE 9000 9001
ENTRYPOINT ["/usr/local/bin/minio"]
CMD ["server", "/data", "--console-address", ":9001"]

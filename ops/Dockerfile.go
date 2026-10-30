FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY apps/settlement/go.mod apps/settlement/go.sum* ./
RUN go mod download
COPY apps/settlement/ .

# Doğrudan main.go'nun bulunduğu alt dizini derliyoruz
RUN CGO_ENABLED=0 GOOS=linux go build -o /settlement ./cmd/settlement

FROM alpine:latest
WORKDIR /root/
COPY --from=builder /settlement .
EXPOSE 8091
CMD ["./settlement", "daemon"]

FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY apps/settlement/go.mod apps/settlement/go.sum* ./
RUN go mod download
COPY apps/settlement/ .
RUN CGO_ENABLED=0 GOOS=linux go build -o /settlement ./cmd/settlement

FROM alpine:3.20
RUN apk add --no-cache ca-certificates && adduser -D -u 10001 app
WORKDIR /app
COPY --from=builder /settlement .
USER app
EXPOSE 8091
CMD ["./settlement", "daemon"]

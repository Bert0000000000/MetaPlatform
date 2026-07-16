package main

import (
	"context"
	"fmt"
	"log"
	"time"

	kgo "github.com/segmentio/kafka-go"
)

func main() {
	r := kgo.NewReader(kgo.ReaderConfig{
		Brokers:     []string{"mp-kafka-spike:9092"},
		GroupID:     "verify-group-v1",
		GroupTopics: []string{"metaplatform.ontology.entity-type"},
		MinBytes:    1,
		MaxBytes:    10e6,
		StartOffset: kgo.FirstOffset,
	})
	defer r.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	count := 0
	for {
		m, err := r.FetchMessage(ctx)
		if err != nil {
			break
		}
		count++
		headers := map[string]string{}
		for _, h := range m.Headers {
			headers[h.Key] = string(h.Value)
		}
		log.Printf("MSG #%d topic=%s key=%s value-len=%d traceId=%s",
			count, m.Topic, string(m.Key), len(m.Value), headers["X-Trace-Id"])
		_ = r.CommitMessages(ctx, m)
		if count >= 5 {
			break
		}
	}
	fmt.Printf("VERIFIED: %d message(s) consumed\n", count)
}

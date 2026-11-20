package services

import (
	"testing"
	"servicedesk/internal/models"
)

func TestValidTransition(t *testing.T) {
	cases := []struct { from, to models.TicketStatus; valid bool }{
		{models.StatusNew, models.StatusAssigned, true},
		{models.StatusNew, models.StatusClosed, false},
		{models.StatusInProgress, models.StatusResolved, true},
		{models.StatusResolved, models.StatusClosed, true},
		{models.StatusClosed, models.StatusInProgress, false},
		{models.StatusCancelled, models.StatusNew, false},
	}
	for _, test := range cases { if got := validTransition(test.from, test.to); got != test.valid { t.Errorf("transition %s -> %s: got %t, want %t", test.from, test.to, got, test.valid) } }
}

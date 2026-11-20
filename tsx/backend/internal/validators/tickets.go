package validators

import (
	"fmt"
	"strings"
	"servicedesk/internal/models"
)

func Ticket(title string, categoryID uint, priority models.Priority) error {
	if len(strings.TrimSpace(title)) < 5 { return fmt.Errorf("title must contain at least 5 characters") }
	if categoryID == 0 { return fmt.Errorf("categoryId is required") }
	if priority != "" && priority != models.PriorityLow && priority != models.PriorityMedium && priority != models.PriorityHigh && priority != models.PriorityCritical { return fmt.Errorf("invalid priority") }
	return nil
}
func Comment(message string) error { if len(strings.TrimSpace(message)) == 0 { return fmt.Errorf("message is required") }; if len([]rune(message)) > 4000 { return fmt.Errorf("message is too long") }; return nil }
func Category(name string) error { if len(strings.TrimSpace(name)) < 2 { return fmt.Errorf("name must contain at least 2 characters") }; return nil }
func Status(value models.TicketStatus) error { switch value { case models.StatusNew, models.StatusAssigned, models.StatusInProgress, models.StatusPending, models.StatusResolved, models.StatusClosed, models.StatusCancelled: return nil }; return fmt.Errorf("invalid ticket status") }

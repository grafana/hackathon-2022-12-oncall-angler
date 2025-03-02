from apps.alerts.incident_appearance.templaters.alert_templater import AlertTemplater
from common.utils import str_or_backup


class AlertMobileAppTemplater(AlertTemplater):
    def _render_for(self):
        return "MOBILE_APP"


def get_push_notification_message(alert_group):
    alert = alert_group.alerts.first()
    templated_alert = AlertMobileAppTemplater(alert).render()
    return str_or_backup(templated_alert.title, "Alert Group")

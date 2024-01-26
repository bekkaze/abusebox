from apps.hostname.models import Hostname, CheckHistory
from apps.blacklist.utils.blacklist_check_util import check_dnsbl_providers
from apps.hostname.apis.serializers import CheckHistorySerializer

def run():
  hostnames = Hostname.objects.filter(status='active').all()
  CheckHistory.objects.filter(status='current').update(status='old')

  for hostname in hostnames:
    result = check_dnsbl_providers(hostname.hostname)
    if result['detected_on'] != []:
      for detected_provider in result['detected_on']:
        detected_provider['status'] = 'open'
        detected_provider['respone'] = None

    check_history_model: dict = {
      'hostname': hostname.id,
      'result': result,
      'status': 'current'
    }

    serializer = CheckHistorySerializer(data=check_history_model)
    if serializer.is_valid():
      serializer.save() 
    else:
      print(serializer.errors)
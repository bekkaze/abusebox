import socket 
from typing import Tuple

# NEED DETERMINE CATEGORIES
BASE_PROVIDERS = [
  {'provider': 'all.s5h.net', 'categories': ['unknown']},
  {'provider': 'aspews.ext.sorbs.net', 'categories': ['unknown']},
  {'provider': 'b.barracudacentral.org', 'categories': ['unknown']},
  {'provider': 'bl.nordspam.com', 'categories': ['']},
  {'provider': 'blackholes.five-ten-sg.com', 'categories': ['unknown']},
  {'provider': 'blacklist.woody.ch', 'categories': ['unknown']},
  {'provider': 'bogons.cymru.com', 'categories': ['unknown']},
  {'provider': 'cbl.abuseat.org', 'categories': ['unknown']},
  {'provider': 'combined.abuse.ch', 'categories': ['unknown']},
  {'provider': 'combined.rbl.msrbl.net', 'categories': ['unknown']},
  {'provider': 'db.wpbl.info', 'categories': ['unknown']},
  {'provider': 'dnsbl-2.uceprotect.net', 'categories': ['unknown']},
  {'provider': 'dnsbl-3.uceprotect.net', 'categories': ['unknown']},
  {'provider': 'dnsbl.cyberlogic.net', 'categories': ['unknown']},
  {'provider': 'dnsbl.sorbs.net', 'categories': ['unknown']},
  {'provider': 'drone.abuse.ch', 'categories': ['unknown']},
  {'provider': 'images.rbl.msrbl.net', 'categories': ['unknown']},
  {'provider': 'ips.backscatterer.org', 'categories': ['unknown']},
  {'provider': 'ix.dnsbl.manitu.net', 'categories': ['unknown']},
  {'provider': 'korea.services.net', 'categories': ['unknown']},
  {'provider': 'matrix.spfbl.net', 'categories': ['unknown']},
  {'provider': 'phishing.rbl.msrbl.net', 'categories': ['unknown']},
  {'provider': 'proxy.bl.gweep.ca', 'categories': ['unknown']},
  {'provider': 'proxy.block.transip.nl', 'categories': ['unknown']},
  {'provider': 'psbl.surriel.com', 'categories': ['unknown']},
  {'provider': 'rbl.interserver.net', 'categories': ['unknown']},
  {'provider': 'relays.bl.gweep.ca', 'categories': ['unknown']},
  {'provider': 'relays.bl.kundenserver.de', 'categories': ['unknown']},
  {'provider': 'relays.nether.net', 'categories': ['unknown']},
  {'provider': 'residential.block.transip.nl', 'categories': ['unknown']},
  {'provider': 'singular.ttk.pte.hu', 'categories': ['unknown']},
  {'provider': 'spam.dnsbl.sorbs.net', 'categories': ['unknown']},
  {'provider': 'spam.rbl.msrbl.net', 'categories': ['unknown']},
  {'provider': 'spambot.bls.digibase.ca', 'categories': ['unknown']},
  {'provider': 'spamlist.or.kr', 'categories': ['unknown']},
  {'provider': 'spamrbl.imp.ch', 'categories': ['unknown']},
  {'provider': 'spamsources.fabel.dk', 'categories': ['unknown']},
  {'provider': 'ubl.lashback.com', 'categories': ['unknown']},
  {'provider': 'virbl.bit.nl', 'categories': ['unknown']},
  {'provider': 'virus.rbl.msrbl.net', 'categories': ['unknown']},
  {'provider': 'virus.rbl.jp', 'categories': ['unknown']},
  {'provider': 'wormrbl.imp.ch', 'categories': ['unknown']},
  {'provider': 'z.mailspike.net', 'categories': ['unknown']},
  {'provider': 'netscan.rbl.blockedservers.com', 'categories': ['unknown']},
]

# Blacklist check from source 
def check_dnsbl(reversed_ip: str, provider: str) -> Tuple[bool, str]: 
  query = f'{reversed_ip}.{provider}'
  try: 
    response = socket.gethostbyname(query)
    return True, response
  except: # if name or service not know it means ip is not blacklisted 
    return False, '' 

# Now only ip address domain address is not implemented yet...
def check_dnsbl_providers(ip_address: str) -> dict: 
  reversed_ip = '.'.join(reversed(ip_address.split('.')))
  result: dict = {
    'detected_on': [],
    'providers': [],
    'is_blacklisted': False,
    'hostname': ip_address,
    'categories': [] 
  }

  for provider in BASE_PROVIDERS:
    chck, resp = check_dnsbl(reversed_ip, provider['provider']) # LATER WILL USE RESP for category...
    result['providers'].append(provider['provider'])
    if chck: 
      result['detected_on'].append(
        {
          'provider': provider['provider'],
          'categories': provider['categories']
        }
      )

      result['categories'].extend(category for category in provider['categories'] if category not in result['categories'])
      result['is_blacklisted'] = True 

  return result
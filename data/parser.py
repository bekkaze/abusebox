#!/usr/bin/env python3 

import re 
import ast 

import requests

with open('data6.txt') as f: 
    ips = f.readlines() 

for r in ips:
  try:
    result = r.split(': d')[0]
    detected_by = r.split('>: ')[1].replace('\n', '')

    pattern = r"\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b"
    match = re.search(pattern, result)
    ip_address = match.group()

    detected_by = ast.literal_eval(detected_by.replace('dict_items(', '')[:-1])
    
    if 'BLACKLISTED' in result: 
      status = 'blacklisted'
    else:
      status = 'normal'

    post_data = {
      'ipaddress': ip_address,
      'subnet': '32',
      'description': 'Check blacklist for Mongolian IP reputation',
      'userid': 2,
      'blacklists': {'blacklists': detected_by},
      'status': status
    }

    resp = requests.post('http://localhost:8000/api/ipaddress/',
          json=post_data
        )

    print('\033[92m' + resp.text + '\033[0m')

  except Exception as e:
    print(e)
    print(r)

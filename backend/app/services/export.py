import csv
import io
from typing import Any


def export_blacklist_csv(data: dict[str, Any]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["Hostname", data.get("hostname", "")])
    writer.writerow(["Blacklisted", "Yes" if data.get("is_blacklisted") else "No"])
    writer.writerow([])

    writer.writerow(["Provider", "Status", "Categories"])

    providers = data.get("providers", [])
    detected_map = {item["provider"]: item for item in data.get("detected_on", [])}

    for provider in providers:
        if provider in detected_map:
            item = detected_map[provider]
            status = item.get("status", "open")
            categories = ", ".join(item.get("categories", []))
        else:
            status = "clear"
            categories = ""
        writer.writerow([provider, status, categories])

    if data.get("failed_providers"):
        writer.writerow([])
        writer.writerow(["Failed Providers"])
        for fp in data["failed_providers"]:
            writer.writerow([fp])

    return output.getvalue()


def export_subnet_csv(data: dict[str, Any]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["CIDR", data.get("cidr", "")])
    writer.writerow(["Total IPs", data.get("total_ips", 0)])
    writer.writerow(["Blacklisted", data.get("blacklisted_count", 0)])
    writer.writerow([])

    writer.writerow(["IP", "Blacklisted", "Listed On"])

    for result in data.get("results", []):
        writer.writerow([
            result["ip"],
            "Yes" if result["is_blacklisted"] else "No",
            ", ".join(result.get("listed_on", [])),
        ])

    return output.getvalue()

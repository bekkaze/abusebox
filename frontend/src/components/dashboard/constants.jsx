import {
	HiOutlineSquares2X2,
	HiOutlineServerStack,
	HiOutlineClock,
	HiOutlineCog6Tooth,
	HiOutlineShieldCheck,
	HiOutlineRectangleStack,
	HiOutlineTableCells,
	HiOutlineFlag,
	HiOutlineGlobeAlt,
	HiOutlineServer,
	HiOutlineLockClosed,
	HiOutlineEnvelope,
	HiOutlineDocumentText,
	HiOutlineSignal,
	HiOutlineBookOpen,
} from 'react-icons/hi2'

export const DASHBOARD_SIDEBAR_SECTIONS = [
	{
		label: 'Monitor',
		links: [
			{
				key: 'dashboard',
				label: 'Dashboard',
				path: '/dashboard',
				icon: <HiOutlineSquares2X2 />
			},
			{
				key: 'assets',
				label: 'Assets',
				path: '/dashboard/assets',
				icon: <HiOutlineServerStack />
			},
			{
				key: 'activity',
				label: 'Activity',
				path: '/dashboard/activity',
				icon: <HiOutlineClock />
			},
		],
	},
	{
		// Ten entries, so only the ones marked primary show until the group is
		// expanded. Cmd+K reaches any of them without the nav being this tall.
		label: 'Tools',
		collapsible: true,
		links: [
			{
				key: 'blacklist-check',
				primary: true,
				label: 'Blacklist check',
				path: '/dashboard/blacklist-check',
				icon: <HiOutlineShieldCheck />
			},
			{
				key: 'bulk-check',
				primary: true,
				label: 'Bulk check',
				path: '/dashboard/bulk-check',
				icon: <HiOutlineRectangleStack />
			},
			{
				key: 'subnet-check',
				label: 'Subnet / CIDR',
				path: '/dashboard/subnet-check',
				icon: <HiOutlineTableCells />
			},
			{
				key: 'abuseipdb',
				label: 'AbuseIPDB',
				path: '/dashboard/abuseipdb',
				icon: <HiOutlineFlag />
			},
			{
				key: 'whois',
				label: 'WHOIS',
				path: '/dashboard/whois',
				icon: <HiOutlineGlobeAlt />
			},
			{
				key: 'dns-records',
				label: 'DNS records',
				path: '/dashboard/dns-records',
				icon: <HiOutlineServer />
			},
			{
				key: 'ssl-checker',
				primary: true,
				label: 'SSL certificate',
				path: '/dashboard/ssl-checker',
				icon: <HiOutlineLockClosed />
			},
			{
				key: 'email-security',
				primary: true,
				label: 'SPF/DKIM/DMARC',
				path: '/dashboard/email-security',
				icon: <HiOutlineEnvelope />
			},
			{
				key: 'dmarc-reports',
				label: 'DMARC reports',
				path: '/dashboard/dmarc-reports',
				icon: <HiOutlineDocumentText />
			},
			{
				key: 'server-status',
				label: 'Server status',
				path: '/dashboard/server-status',
				icon: <HiOutlineSignal />
			},
		],
	},
]

export const DASHBOARD_SIDEBAR_BOTTOM_LINKS = [
	{
		key: 'settings',
		label: 'Settings',
		path: '/dashboard/settings',
		icon: <HiOutlineCog6Tooth />
	},
	{
		key: 'support',
		label: 'API docs',
		path: import.meta.env.VITE_API_DOCS_URL || '/api/swagger/',
		icon: <HiOutlineBookOpen />
	}
]

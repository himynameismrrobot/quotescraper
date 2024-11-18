import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Building2, Mic2, Link as LinkIcon, Quote, BookMarked, Bot } from 'lucide-react';

const menuItems = [
  { icon: Bot, label: 'Agents', href: '/admin#agents' },
  { icon: Building2, label: 'Organizations', href: '/admin#organizations' },
  { icon: Mic2, label: 'Speakers', href: '/admin#speakers' },
  { icon: LinkIcon, label: 'URLs', href: '/admin#urls' },
  { icon: Quote, label: 'New Quotes', href: '/admin#new-quotes' },
  { icon: BookMarked, label: 'Saved Quotes', href: '/admin#saved-quotes' },
];

const Sidebar: React.FC = () => {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const section = href.split('#')[1];
    router.push(href, undefined, { shallow: true });
  };

  return (
    <aside className="bg-gray-800 text-white w-64 min-h-screen p-4">
      <nav>
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.label}>
              <Link 
                href={item.href} 
                className="flex items-center space-x-2 p-2 rounded hover:bg-gray-700"
                onClick={(e) => handleClick(e, item.href)}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar; 
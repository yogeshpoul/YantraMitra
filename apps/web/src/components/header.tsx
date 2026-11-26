'use client';
import { Compass, Heart, List, LogIn, Menu, PlusCircle, Shield, User, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { useAuth } from './auth-context';
import { Logo } from './equipment-art';
import { LanguageSwitcher } from './language-switcher';
import { buttonClass, cx } from './ui';

export function Header() {
  const t = useTranslations();
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = user
    ? [
        { href: '/equipment', label: t('nav.explore'), icon: Compass },
        { href: '/listings/new', label: t('nav.addEquipment'), icon: PlusCircle },
        { href: '/my-listings', label: t('nav.myListings'), icon: List },
        { href: '/saved', label: t('nav.saved'), icon: Heart },
        { href: '/profile', label: t('nav.profile'), icon: User },
        ...(user.isAdmin ? [{ href: '/admin', label: t('nav.admin'), icon: Shield }] : []),
      ]
    : [{ href: '/equipment', label: t('nav.explore'), icon: Compass }];

  const active = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));

  return (
    <header className="sticky top-0 z-40 border-b border-soil-200 bg-white/95 backdrop-blur">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded-lg focus:bg-white focus:p-2">{t('common.skipToContent')}</a>
      <div className="container-page flex h-16 items-center gap-3">
        <Link href="/" className="flex items-center gap-2" aria-label={t('common.appName')}>
          <Logo className="size-9" />
          <span className="font-display text-2xl font-bold text-leaf-800">{t('common.appName')}</span>
        </Link>
        <nav className="ml-6 hidden flex-1 items-center gap-1 lg:flex" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={active(l.href) ? 'page' : undefined}
              className={cx('rounded-lg px-3 py-2 font-medium hover:bg-leaf-50', active(l.href) ? 'text-leaf-700 underline decoration-2 underline-offset-8' : 'text-ink')}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher compact />
          {!loading && !user && (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/login" className={buttonClass('ghost', 'min-h-10')}>{t('nav.login')}</Link>
              <Link href="/register" className={buttonClass('primary', 'min-h-10')}>{t('nav.register')}</Link>
            </div>
          )}
          <button type="button" className="rounded-lg p-2 lg:hidden" aria-expanded={open} aria-controls="mobile-nav" aria-label={t('common.menu')} onClick={() => setOpen((o) => !o)}>
            {open ? <X className="size-7" /> : <Menu className="size-7" />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" className="border-t border-soil-200 bg-white lg:hidden" aria-label="Main">
          <ul className="container-page py-2">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOpen(false)} className="flex min-h-12 items-center gap-3 rounded-lg px-2 text-lg font-medium hover:bg-leaf-50">
                  <l.icon className="size-5 text-leaf-600" aria-hidden />{l.label}
                </Link>
              </li>
            ))}
            {!user && (
              <>
                <li><Link href="/login" onClick={() => setOpen(false)} className="flex min-h-12 items-center gap-3 px-2 text-lg font-medium"><LogIn className="size-5 text-leaf-600" />{t('nav.login')}</Link></li>
                <li><Link href="/register" onClick={() => setOpen(false)} className="flex min-h-12 items-center gap-3 px-2 text-lg font-medium"><User className="size-5 text-leaf-600" />{t('nav.register')}</Link></li>
              </>
            )}
          </ul>
        </nav>
      )}
    </header>
  );
}

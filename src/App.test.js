import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Menu from './pages/Menu';
import { MENU_APPS } from './constants/menuApps';

test('apps menu links every app plus the wallet', () => {
  render(
    <MemoryRouter>
      <Menu />
    </MemoryRouter>
  );

  expect(screen.getByRole('heading', { name: 'Apps' })).toBeInTheDocument();
  MENU_APPS.forEach((app) => {
    expect(screen.getByText(app.name).closest('a')).toHaveAttribute('href', app.href);
  });
  expect(screen.getByText('My Wallet').closest('a')).toHaveAttribute('href', '/wallet');
});

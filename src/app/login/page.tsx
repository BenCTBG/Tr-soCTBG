'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('Email ou mot de passe incorrect');
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-ctbg-red to-ctbg-red-dark">
      <div className="bg-white p-12 rounded-xl shadow-card-lg w-full max-w-[400px]">
        <div className="text-center mb-8">
          <div className="inline-block bg-ctbg-red px-8 py-4 rounded-lg">
            <span className="text-white font-black text-4xl tracking-[6px] font-sans">CTBG</span>
          </div>
        </div>

        <h1 className="text-center text-xl font-semibold text-gray-dark mb-6">
          Gestion de Trésorerie
        </h1>

        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-dark mb-1.5 uppercase tracking-wide">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-border rounded-md text-sm focus:outline-none focus:border-ctbg-red focus:ring-2 focus:ring-ctbg-red/10"
              placeholder="votre@email.fr"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-dark mb-1.5 uppercase tracking-wide">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-border rounded-md text-sm focus:outline-none focus:border-ctbg-red focus:ring-2 focus:ring-ctbg-red/10"
              placeholder="Entrer un mot de passe"
              required
            />
          </div>

          {error && <p className="text-error text-sm mb-4 text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-ctbg-red text-white border-none rounded-md text-sm font-semibold uppercase tracking-wide mt-2 hover:bg-ctbg-red-hover hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Connexion...' : 'Connexion'}
          </button>
        </form>
      </div>
    </div>
  );
}

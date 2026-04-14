'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

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
    <div className="flex items-center justify-center min-h-screen bg-black relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-0 w-96 h-96 bg-ctbg-red rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-ctbg-red rounded-full translate-x-1/3 translate-y-1/3" />
      </div>

      <div className="relative z-10 w-full max-w-[440px] mx-4">
        {/* Logo card */}
        <div className="text-center mb-8">
          <Image
            src="/logo-ctbg-noir.svg"
            alt="CTBG"
            width={200}
            height={68}
            priority
            className="h-16 w-auto mx-auto"
          />
        </div>

        {/* Login card */}
        <div className="bg-white p-10 rounded-2xl shadow-card-lg">
          <h1 className="text-center text-lg font-semibold text-gray-dark mb-1">
            Gestion de Trésorerie
          </h1>
          <p className="text-center text-sm text-gray-text mb-8">
            Connectez-vous pour accéder à votre espace
          </p>

          <form onSubmit={handleLogin}>
            <div className="mb-5">
              <label className="block text-xs font-semibold text-gray-dark mb-2 uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-border rounded-lg text-sm bg-gray-light/50 focus:outline-none focus:border-ctbg-red focus:ring-2 focus:ring-ctbg-red/10 focus:bg-white transition-all"
                placeholder="votre@email.fr"
                required
              />
            </div>

            <div className="mb-5">
              <label className="block text-xs font-semibold text-gray-dark mb-2 uppercase tracking-wide">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-border rounded-lg text-sm bg-gray-light/50 focus:outline-none focus:border-ctbg-red focus:ring-2 focus:ring-ctbg-red/10 focus:bg-white transition-all"
                placeholder="Entrer votre mot de passe"
                required
              />
            </div>

            {error && (
              <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-error text-sm text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-ctbg-red text-white border-none rounded-lg text-sm font-semibold uppercase tracking-wide mt-1 hover:bg-ctbg-red-hover hover:-translate-y-0.5 hover:shadow-card-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Connexion...
                </span>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-text/40 mt-6">
          CTBG Groupe — Trésorerie v1.0
        </p>
      </div>
    </div>
  );
}

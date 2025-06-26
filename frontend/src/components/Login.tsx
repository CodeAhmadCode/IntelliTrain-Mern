import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, Eye, EyeOff, Github, AlertCircle } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';

interface LoginSignupProps {
  setIsAuthenticated: (value: boolean) => void;
}

const LoginSignup: React.FC<LoginSignupProps> = ({ setIsAuthenticated }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    apiError: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const calculatePasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^A-Za-z0-9]/)) strength++;
    return strength;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (name === 'password') {
      setPasswordStrength(calculatePasswordStrength(value));
      setErrors(prev => ({
        ...prev,
        password: value.length < 8 ? 'Password must be at least 8 characters' : ''
      }));
    }
    
    if (name === 'email' && !/^\S+@\S+\.\S+$/.test(value)) {
      setErrors(prev => ({ ...prev, email: 'Invalid email format' }));
    } else if (name === 'email') {
      setErrors(prev => ({ ...prev, email: '' }));
    }

    if (errors.apiError) {
      setErrors(prev => ({ ...prev, apiError: '' }));
    }
  };

  const validateForm = () => {
    let isValid = true;
    const newErrors = { ...errors };

    if (!formData.email) {
      newErrors.email = 'Email is required';
      isValid = false;
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
      isValid = false;
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
      isValid = false;
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
      isValid = false;
    }

    if (!isLogin && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    setErrors(prev => ({ ...prev, apiError: '' }));

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        }),
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      if (data.success) {
        localStorage.setItem('token', data.token);
        setIsAuthenticated(true);
        navigate('/');
      }
    } catch (error) {
      setErrors(prev => ({ 
        ...prev, 
        apiError: error instanceof Error ? error.message : 'Failed to process your request' 
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="min-h-screen flex items-center justify-center bg-space-black text-white p-6 relative pt-20">
      <div className="absolute inset-0 grid-pattern opacity-20"></div>
      
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden w-full max-w-md relative border border-white/10"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
        
        <div className="p-8 relative z-10">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-extrabold mb-2 text-glow">
              IntelliTrain
              <span className="block text-lg font-light mt-2">Custom Machine Learning Platform</span>
            </h1>
          </div>

          <div className="flex gap-3 mb-6">
            <button 
              type="button"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded bg-white/5 hover:bg-white/10 transition-all duration-300"
            >
              <FcGoogle size={18} />
              <span>Google</span>
            </button>
            <button 
              type="button"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded bg-white/5 hover:bg-white/10 transition-all duration-300"
            >
              <Github size={18} />
              <span>GitHub</span>
            </button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/20"></div>
            </div>
            <div className="relative flex justify-center text-sm -mt-3">
              <span className="px-2 text-white/70 transform translate-y-3">
                Or continue with email
              </span>
            </div>
          </div>

          {errors.apiError && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{errors.apiError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <Mail size={16} />
                <span>Email address</span>
              </label>
              <input
                name="email"
                type="email"
                placeholder="john@intellitrain.com"
                className="w-full p-3 rounded bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 border border-white/10 focus:border-blue-500 transition-all duration-300 pr-10"
                onChange={handleInputChange}
                value={formData.email}
              />
              {errors.email && (
                <div className="text-red-400 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle size={14} />
                  {errors.email}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <Lock size={16} />
                <span>Password</span>
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full p-3 rounded bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 border border-white/10 focus:border-blue-500 transition-all duration-300 pr-10"
                  onChange={handleInputChange}
                  value={formData.password}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {!isLogin && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 w-full rounded-full transition-all duration-300 ${
                          passwordStrength > i ? 'bg-blue-500' : 'bg-white/10'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-white/50 mt-1">
                    {['Weak', 'Fair', 'Good', 'Strong'][passwordStrength - 1] || 'Very Weak'}
                  </div>
                </div>
              )}
              {errors.password && (
                <div className="text-red-400 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle size={14} />
                  {errors.password}
                </div>
              )}
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Lock size={16} />
                  <span>Confirm Password</span>
                </label>
                <input
                  name="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  className="w-full p-3 rounded bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 border border-white/10 focus:border-blue-500 transition-all duration-300 pr-10"
                  onChange={handleInputChange}
                  value={formData.confirmPassword}
                />
                {errors.confirmPassword && (
                  <div className="text-red-400 text-sm mt-1 flex items-center gap-1">
                    <AlertCircle size={14} />
                    {errors.confirmPassword}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              {isLogin ? (
                <>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded bg-white/5 border-white/10" />
                    <span className="text-white/70">Remember me</span>
                  </label>
                  <Link to="/forgot-password" className="text-blue-400 hover:text-blue-300">
                    Forgot password?
                  </Link>
                </>
              ) : (
                <div className="text-white/70 text-xs">
                  By signing up, you agree to our <br />
                  <a href="#" className="text-blue-400 hover:text-blue-300">Terms of Service</a> and {' '}
                  <a href="#" className="text-blue-400 hover:text-blue-300">Privacy Policy</a>
                </div>
              )}
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded bg-gradient-to-r from-cyan-400 to-blue-500 text-space-black font-bold hover:to-cyan-400 transition-all duration-300 shadow-lg glow-button relative overflow-hidden group flex items-center justify-center disabled:opacity-70"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {isLoading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
                {!isLoading && (
                  <div className="w-4 h-4 bg-white/20 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full animate-pulse" />
                  </div>
                )}
              </span>
            </motion.button>
          </form>

          <motion.div
            className="mt-6 text-center text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            {isLogin ? (
              <p className="text-white/70">
                New to IntelliTrain?{' '}
                <button
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className="text-blue-400 hover:text-blue-300 font-medium"
                >
                  Create account
                </button>
              </p>
            ) : (
              <p className="text-white/70">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className="text-blue-400 hover:text-blue-300 font-medium"
                >
                  Sign in
                </button>
              </p>
            )}
          </motion.div>
        </div>

        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 via-space-black/50 to-indigo-900/30 opacity-60 rounded-2xl z-0" />
      </motion.div>
    </section>
  );
};

export default LoginSignup;
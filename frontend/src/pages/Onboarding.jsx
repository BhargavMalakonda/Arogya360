import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import staticLabels from '../lib/staticLabels';
import CardContainer from '../components/CardContainer';
import PrimaryButton from '../components/PrimaryButton';

// Shared input / select class — rounded-xl, py-3, text-base, brand focus ring
const inputClass =
  'w-full px-4 py-3 text-base border border-gray-300 rounded-xl ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-indigo focus:border-brand-indigo ' +
  'transition-colors';

const Onboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [pincode, setPincode] = useState('');
  const [district, setDistrict] = useState('');
  const [language, setLanguage] = useState('en');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const labels = staticLabels[language] || staticLabels.en;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!user) throw new Error('User not authenticated');
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        name,
        district,
        pincode,
        language_pref: language,
        created_at: serverTimestamp(),
      }, { merge: true });
      navigate('/home');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <CardContainer className="w-full max-w-md">
        <h2 className="text-xl font-bold mb-1">Complete Your Profile</h2>
        <p className="text-sm text-gray-500 mb-5">
          We need a few details to personalise your experience.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="ob-name">
              Full Name
            </label>
            <input
              id="ob-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Priya Sharma"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="ob-pincode">
              Pincode
            </label>
            <input
              id="ob-pincode"
              type="text"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              required
              pattern="[0-9]{6}"
              title="Please enter a valid 6-digit pincode"
              placeholder="6-digit pincode"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="ob-district">
              District
            </label>
            <input
              id="ob-district"
              type="text"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              required
              placeholder="e.g. Srikakulam"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="ob-language">
              Language
            </label>
            <select
              id="ob-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={inputClass}
            >
              <option value="en">English</option>
              <option value="hi">Hindi — हिंदी</option>
              <option value="te">Telugu — తెలుగు</option>
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">{error}</p>
          )}

          <PrimaryButton type="submit" disabled={loading} className="w-full mt-2">
            {loading ? 'Saving…' : 'Save and Continue'}
          </PrimaryButton>
        </form>
      </CardContainer>
    </div>
  );
};

export default Onboarding;

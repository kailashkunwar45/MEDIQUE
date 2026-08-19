import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PatientDashboard from './pages/PatientDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import DoctorCharts from './pages/DoctorCharts';
import DoctorOnboarding from './pages/DoctorOnboarding';
import AdminDashboard from './pages/AdminDashboard';
import AdminCharts from './pages/AdminCharts';
import AdminCaseDetail from './pages/AdminCaseDetail';
import AdminOnboarding from './pages/AdminOnboarding';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import ChatPage from './pages/ChatPage';
import DoctorsPage from './pages/DoctorsPage';
import HospitalsPage from './pages/HospitalsPage';
import HospitalDetailPage from './pages/HospitalDetailPage';
import ProfilePage from './pages/ProfilePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/patient" element={<PatientDashboard />} />
          <Route path="/doctor" element={<DoctorDashboard />} />
          <Route path="/doctor/charts" element={<DoctorCharts />} />
          <Route path="/doctor/onboarding" element={<DoctorOnboarding />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/charts" element={<AdminCharts />} />
          <Route path="/admin/case/detail" element={<AdminCaseDetail />} />
          <Route path="/admin/onboarding" element={<AdminOnboarding />} />
          <Route path="/superadmin" element={<SuperAdminDashboard />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/doctors" element={<DoctorsPage />} />
          <Route path="/hospitals" element={<HospitalsPage />} />
          <Route path="/hospitals/detail" element={<HospitalDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

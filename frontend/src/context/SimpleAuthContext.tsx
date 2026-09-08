import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as authService from '../lib/authService';
import * as attendeeDataService from '../services/attendeeDataService';
import { flushPendingSync } from '../services/syncQueue';
import { adoptGuestData, setUserScope } from '../utils/localStorage';
import { hydrateUserDataFromDb } from '../lib/hydrateUserData';

export type AuthMode = 'checking' | 'needsAuth' | 'auth';

export interface UserProfile {
  id: string;
  email?: string | null;
  firstName: string;
  lastName: string;
  company?: string | null;
  avatarUrl?: string | null;
  designation?: string | null;
  city?: string | null;
  mobileNo?: string | null;
  linkedinUrl?: string | null;
  profileCompleted?: boolean;
  onboardingStep?: number;
  isAdmin?: boolean;
}

interface User {
  username: string;
  password: string;
  id: string;
}

interface AuthContextValue {
  mode: AuthMode;
  profile: UserProfile | null;
  userId: string | null;
  isAdmin: boolean;
  mustChangePassword: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  deleteAccount: (password: string) => Promise<void>;
  // Admin functions
  getAllUsers: () => Promise<any[]>;
  addUser: (username: string, email: string, password: string) => Promise<boolean>;
  deleteUser: (userId: string) => Promise<boolean>;
  updateUsername: (userId: string, newUsername: string) => Promise<boolean>;
  updateUserEmail: (userId: string, newEmail: string) => Promise<boolean>;
  changeUserPassword: (userId: string, newPassword: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<AuthMode>('checking');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('connecthub_token');
      
      if (token) {
        try {
          const { user, profile: userProfile } = await authService.restoreSession();
          setCurrentUserId(user.id);
          setIsAdmin(user.isAdmin);
          setMustChangePassword(Boolean(user.mustChangePassword));
          adoptGuestData(user.id);
          setUserScope(user.id);
          void attendeeDataService.migrateLocalDataOnce(user.id).then(() => flushPendingSync());
          void hydrateUserDataFromDb();
          if (userProfile) {
            setProfile(userProfile);
          } else {
            const newProfile: UserProfile = {
              id: user.id,
              firstName: '',
              lastName: '',
              profileCompleted: false,
              onboardingStep: 0,
              isAdmin: user.isAdmin,
            };
            const saved = await authService.updateProfile(user.id, newProfile);
            setProfile(saved || newProfile);
          }
          setMode('auth');
        } catch (error) {
          console.error('Failed to load profile:', error);
          // Clear invalid session
          localStorage.removeItem('current_user_id');
          localStorage.removeItem('current_username');
          localStorage.removeItem('connecthub_token');
          localStorage.removeItem('connecthub_session_snapshot');
          setUserScope(null);
          setMode('needsAuth');
        }
      } else {
        setMode('needsAuth');
      }
    };

    initAuth();

    const expireSession = () => {
      setProfile(null);
      setCurrentUserId('');
      setIsAdmin(false);
      setMustChangePassword(false);
      setUserScope(null);
      setMode('needsAuth');
    };
    window.addEventListener('connecthub:session-expired', expireSession);
    return () => window.removeEventListener('connecthub:session-expired', expireSession);
  }, []);

  const signIn = async (username: string, password: string) => {
    try {
      const { user, profile: userProfile } = await authService.signIn(username, password);
      
      setCurrentUserId(user.id);
      setIsAdmin(user.isAdmin);
      setMustChangePassword(Boolean(user.mustChangePassword));
      adoptGuestData(user.id);
      setUserScope(user.id);
      void attendeeDataService.migrateLocalDataOnce(user.id).then(() => flushPendingSync());
      void hydrateUserDataFromDb();

      if (userProfile) {
        setProfile(userProfile);
      } else {
        const newProfile: UserProfile = {
          id: user.id,
          firstName: '',
          lastName: '',
          profileCompleted: false,
          onboardingStep: 0,
          isAdmin: user.isAdmin,
        };
        const saved = await authService.updateProfile(user.id, newProfile);
        setProfile(saved || newProfile);
      }
      
      setMode('auth');
    } catch (error: any) {
      throw new Error(error.message || 'Invalid username or password');
    }
  };

  const signOut = async () => {
    await authService.signOut();
    setProfile(null);
    setCurrentUserId('');
    setIsAdmin(false);
    setMustChangePassword(false);
    setUserScope(null);
    setMode('needsAuth');
  };

  const refreshProfile = async () => {
    if (!currentUserId) return;
    const userProfile = await authService.getCurrentProfile(currentUserId);
    if (userProfile) {
      setProfile(userProfile);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!profile || !currentUserId) return;

    const updatedProfile = { ...profile, ...updates };
    const saved = await authService.updateProfile(currentUserId, updatedProfile);
    setProfile(saved || { ...updatedProfile, ...updates });
  };

  const changePassword = async (oldPassword: string, newPassword: string): Promise<boolean> => {
    if (!currentUserId) return false;
    await authService.changePassword(currentUserId, oldPassword, newPassword);
    setMustChangePassword(false);
    return true;
  };

  const deleteAccount = async (password: string): Promise<void> => {
    if (!currentUserId) throw new Error('No user logged in');
    
    try {
      await authService.deleteAccount(currentUserId, password);
      // Clear state and redirect to login
      setProfile(null);
      setCurrentUserId('');
      setIsAdmin(false);
      setMustChangePassword(false);
      setMode('needsAuth');
    } catch (error: any) {
      throw new Error(error.message || 'Failed to delete account');
    }
  };

  // Admin functions
  const getAllUsers = async (): Promise<any[]> => {
    if (!isAdmin) return [];
    return await authService.getAllUsers();
  };

  const addUser = async (username: string, email: string, password: string): Promise<boolean> => {
    if (!isAdmin) return false;
    
    try {
      const result = await authService.createUser(username, email, password);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create user');
      }
      
      return true;
    } catch (error: any) {
      console.error('Add user error:', error);
      throw error;
    }
  };

  const deleteUser = async (userId: string): Promise<boolean> => {
    if (!isAdmin) return false;
    
    try {
      return await authService.deleteUserById(userId);
    } catch (error) {
      console.error('Delete user error:', error);
      return false;
    }
  };

  const updateUsername = async (userId: string, newUsername: string): Promise<boolean> => {
    if (!isAdmin) return false;
    return await authService.updateUsername(userId, newUsername);
  };

  const updateUserEmail = async (userId: string, newEmail: string): Promise<boolean> => {
    if (!isAdmin) return false;
    return await authService.updateUserEmail(userId, newEmail);
  };

  const changeUserPassword = async (userId: string, newPassword: string): Promise<boolean> => {
    if (!isAdmin) return false;
    return await authService.changeUserPasswordByAdmin(userId, newPassword);
  };

  return (
    <AuthContext.Provider
      value={{
        mode,
        profile,
        userId: currentUserId || null,
        isAdmin,
        mustChangePassword,
        signIn,
        signOut,
        refreshProfile,
        updateProfile,
        changePassword,
        deleteAccount,
        getAllUsers,
        addUser,
        deleteUser,
        updateUsername,
        updateUserEmail,
        changeUserPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

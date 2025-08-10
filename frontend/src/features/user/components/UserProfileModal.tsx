import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Mail,
  Calendar,
  Edit3,
  Save,
  Shield,
  Settings,
  UserCircle
} from 'lucide-react';
import {
  Modal,
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardContent
} from '../../../shared/components/ui';

import { useApiClient } from '../../../lib/apiClient';
import { toast } from '../../../shared/components/ui/Toast';

interface UserProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  username?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  open,
  onOpenChange
}) => {
  const { getAuthenticatedClient } = useApiClient();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editForm, setEditForm] = useState({
    name: '',
    username: ''
  });

  useEffect(() => {
    if (open) {
      fetchProfile();
    }
  }, [open]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const client = await getAuthenticatedClient();
      const response = await client.get('/api/v1/user/profile');
      if (response.data.success) {
        const userProfile = response.data.data.user;
        setProfile(userProfile);
        setEditForm({
          name: userProfile.name || '',
          username: userProfile.username || ''
        });
      } else {
        // Use setTimeout to avoid setState during render
        setTimeout(() => {
          toast.error({ title: 'Failed to load profile' });
        }, 0);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      // Use setTimeout to avoid setState during render
      setTimeout(() => {
        toast.error({ title: 'Failed to load profile' });
      }, 0);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const client = await getAuthenticatedClient();
      const response = await client.put('/api/v1/user/profile', editForm);
      if (response.data.success) {
        setProfile(response.data.data.user);
        setEditing(false);
        toast.success({ title: 'Profile updated successfully' });
      } else {
        toast.error({ title: response.data.error || 'Failed to update profile' });
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      const errorMessage = error.response?.data?.error || 'Failed to update profile';
      toast.error({ title: errorMessage });
    } finally {
      setSaving(false);
    }
  };



  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="User Profile"
        description="Manage your account information and preferences"
        size="lg"
      >
        <div className="space-y-4 md:space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : profile ? (
            <>
              {/* Profile Header Card - Responsive */}
              <Card>
                <CardContent className="p-3 md:p-6">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 md:gap-4">
                    <div className="w-12 h-12 md:w-16 md:h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-md flex items-center justify-center shadow-lg flex-shrink-0">
                      <User className="w-6 h-6 md:w-8 md:h-8 text-white" />
                    </div>
                    <div className="flex-1 text-center sm:text-left min-w-0">
                      <h3 className="text-lg md:text-xl font-semibold text-foreground truncate">
                        {profile.username || profile.name}
                      </h3>
                      <p className="text-xs md:text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-1 mt-1">
                        <Mail className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
                        <span className="truncate">{profile.email}</span>
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center justify-center sm:justify-start gap-1 mt-1">
                        <Calendar className="w-2.5 h-2.5 md:w-3 md:h-3 flex-shrink-0" />
                        <span>Member since {formatDate(profile.createdAt)}</span>
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(!editing)}
                      disabled={saving}
                      className="shrink-0 h-8 px-3 text-sm"
                    >
                      <Edit3 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                      <span className="hidden sm:inline">{editing ? 'Close' : 'Edit'}</span>
                      <span className="sm:hidden">{editing ? 'Close' : 'Edit'}</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Profile Information Card */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <UserCircle className="w-5 h-5 text-primary" />
                    Profile Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {editing ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      <Input
                        label="Display Name"
                        value={editForm.name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter your display name"
                      />
                      <Input
                        label="Username"
                        value={editForm.username}
                        onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="Enter your username"
                        helperText="Username must be 3-30 characters and contain only letters, numbers, and underscores."
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={handleSaveProfile}
                          disabled={saving}
                          className="flex-1"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setEditing(false);
                            setEditForm({
                              name: profile.name || '',
                              username: profile.username || ''
                            });
                          }}
                          disabled={saving}
                        >
                          Cancel
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Display Name</p>
                          <p className="text-sm text-muted-foreground">{profile.name}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Email</p>
                          <p className="text-sm text-muted-foreground">{profile.email}</p>
                        </div>
                      </div>

                      {profile.username && (
                        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                          <Shield className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Username</p>
                            <p className="text-sm text-muted-foreground">@{profile.username}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Member Since</p>
                          <p className="text-sm text-muted-foreground">{formatDate(profile.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Account Management Card */}
              {!editing && (
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Settings className="w-5 h-5 text-primary" />
                      Account Management
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="w-5 h-5 text-gray-500" />
                        <h4 className="text-sm font-medium text-gray-800">Account Security</h4>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">
                        Your account is protected and secure. Contact support if you need assistance with account management.
                      </p>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs text-blue-700">
                          <strong>Note:</strong> Account deletion is currently disabled. If you need to delete your account, please contact our support team.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Failed to load profile</p>
            </div>
          )}
        </div>
      </Modal>


    </>
  );
};

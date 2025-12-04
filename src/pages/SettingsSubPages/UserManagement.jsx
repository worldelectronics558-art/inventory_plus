// src/pages/SettingsSubPages/UserManagement.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocations } from '../../contexts/LocationContext';
import { useUser } from '../../contexts/UserContext';
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, collection, getDocs, updateDoc, deleteDoc } from "firebase/firestore";

const UserManagement = () => {
    const { db, secondaryAuth } = useAuth();
    const { locations } = useLocations();
    const { userPermissions, appId } = useUser();

    const [isEditing, setIsEditing] = useState(false);
    const [editingUid, setEditingUid] = useState(null);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('viewer');
    const [assignedLocations, setAssignedLocations] = useState([]);
    const [users, setUsers] = useState([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const fetchUsers = useCallback(async () => {
        if (!db || !appId) return;
        setIsLoadingUsers(true);
        try {
            const usersColRef = collection(db, 'artifacts', appId, 'users');
            const usersSnapshot = await getDocs(usersColRef);
            const userList = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
            setUsers(userList);
        } catch (err) {
            console.error("Error fetching users:", err);
            setError('Failed to load users: ' + err.message);
        } finally {
            setIsLoadingUsers(false);
        }
    }, [db, appId]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    useEffect(() => {
        if (role === 'viewer') setAssignedLocations([]);
    }, [role]);

    const handleLocationChange = (locationId) => {
        setAssignedLocations(prev => prev.includes(locationId) ? prev.filter(id => id !== locationId) : [...prev, locationId]);
    };

    const resetForm = () => {
        setIsEditing(false);
        setEditingUid(null);
        setName('');
        setEmail('');
        setPassword('');
        setRole('viewer');
        setAssignedLocations([]);
        setError('');
        setSuccess('');
    };

    const handleEditClick = (user) => {
        setIsEditing(true);
        setEditingUid(user.uid);
        setName(user.displayName || '');
        setEmail(user.email || '');
        setRole(user.role || 'viewer');
        setAssignedLocations(user.assignedLocations || []);
        setPassword('');
        setError('');
        setSuccess('');
        window.scrollTo(0, 0);
    };

    const handleDeleteUser = async (userId, userEmail) => {
        if (userEmail === 'worl@world.com') {
            alert("This user cannot be deleted.");
            return;
        }

        if (window.confirm(`Are you sure you want to delete the user ${userEmail}? This action only removes the user from the application database, not from the authentication system.`)) {
            try {
                const userDocRef = doc(db, 'artifacts', appId, 'users', userId);
                await deleteDoc(userDocRef);
                setSuccess(`User ${userEmail} deleted successfully.`);
                fetchUsers(); // Refresh the user list
            } catch (err) {
                setError(`Failed to delete user: ${err.message}`);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        const finalAssignedLocations = role === 'viewer' ? [] : assignedLocations;

        if (isEditing) {
            try {
                const userDocRef = doc(db, 'artifacts', appId, 'users', editingUid);
                await updateDoc(userDocRef, { 
                    displayName: name, 
                    role: role, 
                    assignedLocations: finalAssignedLocations 
                });
                
                if (password) {
                    alert("Password update requires a secure backend function and is not implemented in this demo for security reasons.");
                }

                setSuccess(`User ${name} updated successfully!`);
                await fetchUsers();
                resetForm();
            } catch (err) {
                setError('Failed to update user: ' + err.message);
            }
        } else {
            if (!secondaryAuth) {
                setError("User creation service is not available.");
                return;
            }
            let newUserUid = null;
            try {
                const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
                const newUser = userCredential.user;
                newUserUid = newUser.uid;
                await secondaryAuth.signOut();

                const userDocRef = doc(db, 'artifacts', appId, 'users', newUser.uid);
                await setDoc(userDocRef, {
                    displayName: name, 
                    email: email, 
                    role: role, 
                    assignedLocations: finalAssignedLocations, 
                    createdAt: new Date(),
                    lastLogin: new Date(), // Add lastLogin on creation
                });

                setSuccess(`User ${name} created successfully!`);
                await fetchUsers();
                resetForm();
            } catch (err) {
                setError(`Failed to create user: ${err.message}`);
                if (newUserUid) {
                    console.error("Firestore write failed after user was created in Auth. Manual cleanup of user may be required.");
                }
                if (secondaryAuth.currentUser) {
                    await secondaryAuth.signOut();
                }
            }
        }
    };

    const getLocationNames = (locationIds) => {
        if (!locations || locations.length === 0) return 'N/A';
        if (!locationIds || locationIds.length === 0) {
            return 'All (Viewer)';
        }
        return locationIds.map(id => locations.find(l => l.id === id)?.name || 'Unknown').join(', ');
    };

    // Convert timestamp to a readable date string
    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'N/A';
        const date = timestamp.toDate();
        return date.toLocaleString();
    };

    if (userPermissions.role !== 'admin') {
        return <div className="access-denied">Access Denied. You do not have permission to manage users.</div>;
    }

    return (
        <div className="space-y-8">
            <div className="user-form-container bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-4">{isEditing ? 'Edit User' : 'Create New User'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-700">Name</label><input type="text" value={name} onChange={e => setName(e.target.value)} required className="input-base" /></div>
                        <div><label className="block text-sm font-medium text-gray-700">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={isEditing} className={`input-base ${isEditing ? 'bg-gray-200' : ''}`} /></div>
                    </div>
                    <div><label className="block text-sm font-medium text-gray-700">Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required={!isEditing} placeholder={isEditing ? "Leave blank to keep current password" : "Required"} className="input-base" /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                        <div><label className="block text-sm font-medium text-gray-700">Role</label><select value={role} onChange={e => setRole(e.target.value)} className="input-base"><option value="viewer">Viewer</option><option value="manager">Manager</option><option value="admin">Admin</option></select></div>
                        <div>
                            <label className={`block text-sm font-medium ${role === 'viewer' ? 'text-gray-400' : 'text-gray-700'}`}>Assigned Locations</label>
                            <div className={`location-picker mt-1 p-2 border rounded-md ${role === 'viewer' ? 'bg-gray-100' : ''}`}>
                                {locations.map(loc => (
                                    <div key={loc.id} className="flex items-center">
                                        <input type="checkbox" id={`loc-${loc.id}`} checked={assignedLocations.includes(loc.id)} onChange={() => handleLocationChange(loc.id)} disabled={role === 'viewer'} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                        <label htmlFor={`loc-${loc.id}`} className="ml-2 block text-sm text-gray-900">{loc.name}</label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    {success && <p className="text-green-500 text-sm">{success}</p>}
                    <div className="flex justify-end gap-2">
                        {isEditing && <button type="button" onClick={resetForm} className="btn btn-outline">Cancel</button>}
                        <button type="submit" className="btn btn-primary">{isEditing ? 'Update User' : 'Create User'}</button>
                    </div>
                </form>
            </div>

            <div className="user-list-container bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-4">Existing Users</h2>
                {isLoadingUsers ? <p>Loading users...</p> : (
                    <div className="overflow-x-auto">
                        <table className="table-base w-full">
                            <thead>
                                <tr>
                                    <th className="th-base text-left">Name</th>
                                    <th className="th-base text-left">Email</th>
                                    <th className="th-base text-left">Role</th>
                                    <th className="th-base text-left">Locations</th>
                                    <th className="th-base text-left">Last Login</th>
                                    <th className="th-base text-left">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.length > 0 ? users.map(user => (
                                    <tr key={user.uid} className="border-b">
                                        <td className="td-base py-2 px-2">{user.displayName}</td>
                                        <td className="td-base py-2 px-2">{user.email}</td>
                                        <td className="td-base py-2 px-2 capitalize">{user.role}</td>
                                        <td className="td-base py-2 px-2">{getLocationNames(user.assignedLocations)}</td>
                                        <td className="td-base py-2 px-2">{formatTimestamp(user.lastLogin)}</td>
                                        <td className="td-base py-2 px-2">
                                            <button onClick={() => handleEditClick(user)} className="btn btn-sm btn-outline-primary mr-2">Edit</button>
                                            <button onClick={() => handleDeleteUser(user.uid, user.email)} className="btn btn-sm btn-outline-danger">Delete</button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan="6" className="text-center py-4">No users found. Please create a new user to see them listed here.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserManagement;

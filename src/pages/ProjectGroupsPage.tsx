/**
 * Project Groups — Manage group-based access to projects.
 *
 * This page allows admins to define which groups have access to which projects.
 * Users will only be able to access runs for projects they belong to via group membership.
 */
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../AuthContext'
import {
  fetchProjectGroups,
  createProjectGroup,
  deleteProjectGroup,
  fetchProjectPassports,
  fetchUsers,
  fetchUserGroups,
  createUserGroup,
  deleteUserGroup,
  fetchAllGroups,
  type ProjectPassport,
  type ProjectGroupOut,
  type ProjectGroupCreate,
  type GroupOut,
  type UserOut,
} from '../api'
import { useI18n } from '../i18n'

// ── Helper Components ─────────────────────────────────────────────────────────

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <h3 style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)' }}>{title}</h3>
        <div style={{ flex: 1 }} />
        {action}
      </div>
      <div style={{ padding: '0.75rem 1rem' }}>{children}</div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectGroupsPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [projectPassports, setProjectPassports] = useState<ProjectPassport[]>([])
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [groups, setGroups] = useState<ProjectGroupOut[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newGroupForm, setNewGroupForm] = useState<{ project: string; group_name: string }>({ project: '', group_name: '' })
  const [allUsers, setAllUsers] = useState<UserOut[]>([])
  const [selectedGroup, setSelectedGroup] = useState<ProjectGroupOut | null>(null)
  const [groupUsers, setGroupUsers] = useState<{ userId: string; group_name: string; created_at: string }[]>([])
  const [newUserForm, setNewUserForm] = useState<{ group_name: string; user_id: string }>({ group_name: '', user_id: '' })
  const [allGroups, setAllGroups] = useState<GroupOut[]>([])
  const [searchedGroups, setSearchedGroups] = useState<GroupOut[]>([])
  const [isGroupsLoading, setIsGroupsLoading] = useState(true)
  const [userSearchTerm, setUserSearchTerm] = useState<string>('')
  const [searchedUsers, setSearchedUsers] = useState<UserOut[]>([])
  const [searchInputRect, setSearchInputRect] = useState<DOMRect | null>(null)
  const searchInputRef = useRef<HTMLDivElement>(null)

  // Load project passports on mount
  useEffect(() => {
    const loadPassports = async () => {
      try {
        const passports = await fetchProjectPassports()
        setProjectPassports(passports)
        if (passports.length > 0) {
          setSelectedProject(passports[0].project)
        }
      } catch (e) {
        setError(`Failed to load projects: ${(e as Error).message}`)
      }
    }
    loadPassports()
  }, [])

  // Load all users when page loads
  useEffect(() => {
    const loadAllUsers = async () => {
      try {
        const users = await fetchUsers()
        setAllUsers(users)
      } catch (e) {
        // Silently fail - users list is optional
      }
    }
    loadAllUsers()
  }, [])

  // Load all user-group mappings when page loads (for group membership tracking)
  useEffect(() => {
    const loadAllUserGroups = async () => {
      try {
        const allUsers = await fetchUsers()
        const allUserGroups: { userId: string; group_name: string; created_at: string }[] = []
        for (const user of allUsers) {
          try {
            const userGroups = await fetchUserGroups(user.id)
            for (const ug of userGroups) {
              allUserGroups.push({ userId: user.id, group_name: ug.group_name, created_at: ug.created_at })
            }
          } catch (e) {
            // Skip users where group fetch fails
          }
        }
        setGroupUsers(allUserGroups)
      } catch (e) {
        // Silently fail
      }
    }
    loadAllUserGroups()
  }, [])

  // Filter users based on search term
  useEffect(() => {
    if (!userSearchTerm.trim()) {
      setSearchedUsers(allUsers)
      return
    }
    const term = userSearchTerm.toLowerCase()
    setSearchedUsers(
      allUsers.filter(u => u.username.toLowerCase().includes(term) || (u.display_name && u.display_name.toLowerCase().includes(term)))
    )
  }, [userSearchTerm, allUsers])

  // Load all groups for autocomplete
  useEffect(() => {
    const loadAllGroups = async () => {
      try {
        console.log('Fetching all groups...')
        setIsGroupsLoading(true)
        const groups = await fetchAllGroups()
        console.log('Loaded groups:', JSON.stringify(groups, null, 2))
        console.log('Groups array length:', groups.length)
        if (groups.length > 0) {
          console.log('First group:', JSON.stringify(groups[0], null, 2))
        }
        setAllGroups(groups)
      } catch (e) {
        console.error('Failed to load all groups:', e)
        // Silently fail
      } finally {
        setIsGroupsLoading(false)
      }
    }
    loadAllGroups()
  }, [])

  // Load groups for selected project
  useEffect(() => {
    if (selectedProject) {
      loadGroups(selectedProject)
    }
  }, [selectedProject])

  const loadGroups = async (project: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const groups = await fetchProjectGroups(project)
      setGroups(groups)
      if (groups.length > 0 && !selectedGroup) {
        setSelectedGroup(groups[0])
      }
    } catch (e) {
      setError(`Failed to load groups: ${(e as Error).message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteGroup = async (project: string, group_name: string) => {
    if (!window.confirm(`Remove group "${group_name}" from project "${project}"?`)) return

    setIsLoading(true)
    setError(null)
    try {
      await deleteProjectGroup(project, group_name)
      await loadGroups(project)
      if (selectedGroup?.group_name === group_name) {
        setSelectedGroup(null)
        setGroupUsers([])
      }
    } catch (e) {
      setError(`Failed to delete group: ${(e as Error).message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddUserToGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedGroup || !newUserForm.user_id || !selectedProject) return

    setIsLoading(true)
    setError(null)
    try {
      await createUserGroup(newUserForm.user_id, { group_name: selectedGroup.group_name })
      setNewUserForm({ group_name: '', user_id: '' })
      // Reload all user groups to reflect the new membership
      const allUsers = await fetchUsers()
      const updatedGroupUsers: { userId: string; group_name: string; created_at: string }[] = []
      for (const user of allUsers) {
        try {
          const userGroups = await fetchUserGroups(user.id)
          for (const ug of userGroups) {
            updatedGroupUsers.push({ userId: user.id, group_name: ug.group_name, created_at: ug.created_at })
          }
        } catch (e) {
          // Skip users where group fetch fails
        }
      }
      setGroupUsers(updatedGroupUsers)
    } catch (e) {
      setError(`Failed to add user to group: ${(e as Error).message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveUserFromGroup = async (userId: string, groupName: string) => {
    if (!window.confirm(`Remove user from group "${groupName}"?`)) return

    setIsLoading(true)
    setError(null)
    try {
      await deleteUserGroup(userId, groupName)
      // Reload all user groups to reflect the removal
      const allUsers = await fetchUsers()
      const updatedGroupUsers: { userId: string; group_name: string; created_at: string }[] = []
      for (const user of allUsers) {
        try {
          const userGroups = await fetchUserGroups(user.id)
          for (const ug of userGroups) {
            updatedGroupUsers.push({ userId: user.id, group_name: ug.group_name, created_at: ug.created_at })
          }
        } catch (e) {
          // Skip users where group fetch fails
        }
      }
      setGroupUsers(updatedGroupUsers)
    } catch (e) {
      setError(`Failed to remove user from group: ${(e as Error).message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddGroupToProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProject || !newGroupForm.group_name) return

    setIsLoading(true)
    setError(null)
    try {
      const payload: ProjectGroupCreate = {
        project: selectedProject,
        group_name: newGroupForm.group_name,
      }
      await createProjectGroup(payload)
      await loadGroups(selectedProject)
      setNewGroupForm({ project: '', group_name: '' })
    } catch (e) {
      setError(`Failed to add group: ${(e as Error).message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Filter groups based on group_name input change
  useEffect(() => {
    if (!newGroupForm.group_name.trim()) {
      setSearchedGroups([])
      return
    }
    const term = newGroupForm.group_name.toLowerCase()
    console.log('Filtering with term:', term, 'type:', typeof term)
    console.log('allGroups before filter:', allGroups)
    console.log('allGroups[0]:', allGroups[0], 'type:', typeof allGroups[0])
    if (allGroups[0]) {
      console.log('allGroups[0].group_name:', allGroups[0].group_name)
      console.log('Testing includes:', allGroups[0].group_name.toLowerCase().includes(term))
    }
    const filtered = allGroups.filter(g => g.group_name.toLowerCase().includes(term))
    console.log('Filtered groups:', filtered)
    setSearchedGroups(filtered)
  }, [newGroupForm.group_name, allGroups])

  // Get list of projects (sorted)
  const sortedProjects = [...projectPassports].sort((a, b) =>
    a.project.localeCompare(b.project)
  )

  if (user?.role !== 'admin') {
    return (
      <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>
          {t('pages.projectGroups.accessDenied')}
        </h2>
        <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '2rem' }}>
          {t('pages.projectGroups.adminOnly')}
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <svg width="16" height="16" fill="none" stroke="#DA2C38" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.008m-3 6h3a2 2 0 002-2v-6a2 2 0 00-2-2h-3a2 2 0 00-2 2v6a2 2 0 002 2z" />
          </svg>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#DA2C38' }}>Error</span>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{error}</p>
        <button
          onClick={() => setError(null)}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: 'none',
            background: '#DA2C38',
            color: '#fff',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Dismiss
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ── Projects Selector ───────────────────────────────────────────────── */}
      <Card
        title={t('pages.projectGroups.projectsHeader')}
        action={
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
            {projectPassports.length} {t('pages.projectGroups.projectsCount')}
          </span>
        }
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {sortedProjects.map(passport => (
            <button
              key={passport.project}
              onClick={() => setSelectedProject(passport.project)}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: '999px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: selectedProject === passport.project
                  ? '2px solid var(--waf-brand)'
                  : '1px solid var(--border)',
                background: selectedProject === passport.project
                  ? 'rgba(0,148,255,0.08)'
                  : 'var(--bg)',
                color: selectedProject === passport.project ? 'var(--waf-brand)' : 'var(--text)',
              }}
            >
              {passport.project}
            </button>
          ))}
        </div>
        {selectedProject && (
          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem' }}>
              {t('pages.projectGroups.selectedProject')}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
              {t('pages.projectGroups.description')}
            </div>
          </div>
        )}
      </Card>

      {/* ── Groups Management ──────────────────────────────────────────────── */}
      {selectedProject && (
        <Card
          title={t('pages.projectGroups.groupsHeader')}
          action={
            <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
              {groups.length} {t('pages.projectGroups.groupCount')}
            </span>
          }
        >
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem' }} />
              <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                {t('pages.projectGroups.loading')}
              </span>
            </div>
          ) : groups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
              <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24" style={{ margin: '0 auto 1rem' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p style={{ margin: 0, fontSize: '0.78rem' }}>
                {t('pages.projectGroups.noGroups')}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {groups.map(group => {
                const isExpanded = selectedGroup?.group_name === group.group_name
                return (
                  <div
                    key={group.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      background: 'var(--surface)',
                    }}
                  >
                    {/* Group Header */}
                    <div
                      onClick={() => {
                        if (isExpanded) {
                          setSelectedGroup(null)
                        } else {
                          setSelectedGroup(group)
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.65rem 0.75rem',
                        cursor: 'pointer',
                        userSelect: 'none',
                        background: isExpanded ? 'rgba(0,148,255,0.05)' : 'transparent',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = isExpanded ? 'rgba(0,148,255,0.05)' : 'rgba(0,0,0,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.background = isExpanded ? 'rgba(0,148,255,0.05)' : 'transparent')}
                    >
                      <div style={{ flexShrink: 0 }}>
                        {isExpanded ? (
                          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </div>
                      <div
                        style={{
                          flexShrink: 0,
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: 'rgba(34,197,94,0.12)',
                          border: '1px solid rgba(34,197,94,0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#22c55e',
                        }}
                      >
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text)' }}>
                          {group.group_name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
                          {t('pages.projectGroups.addedOn')} {new Date(group.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteGroup(selectedProject, group.group_name)
                        }}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '6px',
                          border: 'none',
                          background: 'rgba(218,44,56,0.08)',
                          color: '#DA2C38',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                        title={t('pages.projectGroups.deleteGroup')}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(218,44,56,0.15)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(218,44,56,0.08)')}
                      >
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Expanded Users List */}
                    {isExpanded && (
                      <>
                        <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' }}>
                            {t('pages.projectGroups.usersHeader')} ({groupUsers.filter(gu => gu.group_name === group.group_name).length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                            {allUsers.length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--muted)', fontSize: '0.72rem' }}>
                                {t('pages.projectGroups.noUsers')}
                              </div>
                            ) : (
                              allUsers.map(user => {
                                const isInGroup = groupUsers.some(gu => gu.userId === user.id && gu.group_name === group.group_name)
                                return (
                                  <div
                                    key={user.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.5rem',
                                      padding: '0.4rem 0.6rem',
                                      borderRadius: '6px',
                                      background: isInGroup ? 'rgba(34,197,94,0.08)' : 'rgba(0,0,0,0.03)',
                                    }}
                                  >
                                    <div style={{ flex: 1, fontSize: '0.76rem', color: 'var(--text)' }}>
                                      {user.display_name || user.username}
                                    </div>
                                    {isInGroup && (
                                      <button
                                        onClick={() => handleRemoveUserFromGroup(user.id, group.group_name)}
                                        style={{
                                          padding: '0.25rem 0.5rem',
                                          borderRadius: '4px',
                                          border: 'none',
                                          background: 'rgba(218,44,56,0.08)',
                                          color: '#DA2C38',
                                          fontSize: '0.68rem',
                                          fontWeight: 600,
                                          cursor: 'pointer',
                                        }}
                                      >
                                        Remove
                                      </button>
                                    )}
                                  </div>
                                )
                              })
                            )}
                          </div>
                        </div>

                        {/* User Search Dropdown - positioned at document body level */}
                        {userSearchTerm.trim() && searchedUsers.length > 0 && searchInputRect && (
                          <div
                            style={{
                              position: 'fixed',
                              left: searchInputRect.left,
                              top: searchInputRect.bottom + 8,
                              width: searchInputRect.width,
                              zIndex: 10000,
                            }}
                          >
                            <div
                              style={{
                                width: 'min(500px, 100%)',
                                maxHeight: '250px',
                                overflowY: 'auto',
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: '8px',
                                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                              }}
                            >
                              {searchedUsers.map(user => {
                                const isInGroup = groupUsers.some(gu => gu.userId === user.id && gu.group_name === group.group_name)
                                return (
                                  <button
                                    key={user.id}
                                    type="button"
                                    onClick={() => {
                                      setNewUserForm({ ...newUserForm, user_id: user.id, group_name: group.group_name })
                                      setUserSearchTerm('')
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '0.6rem 0.9rem',
                                      border: 'none',
                                      background: 'transparent',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.6rem',
                                      fontSize: '0.76rem',
                                      color: 'var(--text)',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,148,255,0.08)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                  >
                                    <div style={{
                                      flexShrink: 0,
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '6px',
                                      background: 'rgba(34,197,94,0.12)',
                                      border: '1px solid rgba(34,197,94,0.3)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#22c55e',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                    }}>
                                      {(user.display_name || user.username)[0].toUpperCase()}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <div>{user.display_name || user.username}</div>
                                      <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{user.username}</div>
                                    </div>
                                    {isInGroup && (
                                      <span style={{ fontSize: '0.68rem', color: '#22c55e', fontWeight: 600 }}>
                                        Already in group
                                      </span>
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* User Search Input - placed outside the overflow container */}
                        <div style={{ padding: '0.75rem', paddingTop: '0.5rem' }}>
                          <div
                            ref={searchInputRef}
                            style={{ position: 'relative', marginBottom: '0.5rem' }}
                          >
                            <input
                              type="text"
                              value={userSearchTerm}
                              onChange={e => setUserSearchTerm(e.target.value)}
                              placeholder="Search users..."
                              style={{
                                width: '100%',
                                background: 'var(--input-bg)',
                                color: 'var(--text)',
                                border: '1px solid var(--border)',
                                borderRadius: '6px',
                                padding: '0.35rem 0.6rem',
                                fontSize: '0.74rem',
                                outline: 'none',
                              }}
                              onInput={() => {
                                if (searchInputRef.current) {
                                  setSearchInputRect(searchInputRef.current.getBoundingClientRect())
                                }
                              }}
                            />
                          </div>

                          {/* Add User Form */}
                          <form onSubmit={handleAddUserToGroup} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button
                              type="submit"
                              disabled={isLoading || !newUserForm.user_id}
                              style={{
                                padding: '0.4rem 0.8rem',
                                borderRadius: '6px',
                                border: 'none',
                                background: '#0094ff',
                                color: '#fff',
                                fontSize: '0.76rem',
                                fontWeight: 600,
                                cursor: isLoading || !newUserForm.user_id ? 'not-allowed' : 'pointer',
                                transition: 'all 0.15s',
                              }}
                            >
                              {t('pages.projectGroups.addBtn')}
                            </button>
                            {newUserForm.user_id && (
                              <span style={{ fontSize: '0.72rem', color: '#22c55e' }}>
                                Selected: {allUsers.find(u => u.id === newUserForm.user_id)?.display_name || allUsers.find(u => u.id === newUserForm.user_id)?.username}
                              </span>
                            )}
                          </form>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Add Group to Project Form */}
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <form
              onSubmit={handleAddGroupToProject}
              style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexDirection: 'column' }}
            >
              <div style={{ width: '100%', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <input
                    type="text"
                    value={newGroupForm.group_name}
                    onChange={e => {
                      setNewGroupForm({ ...newGroupForm, group_name: e.target.value })
                    }}
                    placeholder={t('pages.projectGroups.groupNamePlaceholder')}
                    style={{
                      width: '100%',
                      background: 'var(--input-bg)',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.82rem',
                      outline: 'none',
                    }}
                  />
                  {/* Show matching existing groups */}
                  {isGroupsLoading ? (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--muted)' }}>
                      Loading available groups...
                    </div>
                  ) : searchedGroups.length > 0 ? (
                    <div style={{ marginTop: '0.5rem', width: '100%' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem' }}>
                        Matching existing groups:
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {searchedGroups.map(group => (
                          <button
                            key={group.group_name}
                            type="button"
                            onClick={() => {
                              setNewGroupForm(prev => ({ ...prev, group_name: group.group_name }))
                            }}
                            style={{
                              padding: '0.25rem 0.5rem',
                              borderRadius: '999px',
                              border: '1px solid var(--border)',
                              background: 'var(--surface)',
                              color: 'var(--text)',
                              fontSize: '0.72rem',
                              cursor: 'pointer',
                            }}
                          >
                            {group.group_name} <span style={{ color: 'var(--muted)' }}>({group.user_count} users, {group.projects.length} project(s))</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : allGroups.length > 0 ? (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--muted)' }}>
                      No matching groups found
                    </div>
                  ) : (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--muted)' }}>
                      No groups available (create groups first)
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isLoading || !newGroupForm.group_name}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#0094ff',
                    color: '#fff',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: isLoading || !newGroupForm.group_name ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {t('pages.projectGroups.addBtn')}
                </button>
              </div>
            </form>
            <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--muted)' }}>
              {t('pages.projectGroups.addDesc')}
            </div>
          </div>
        </Card>
      )}

      {/* ── Info Box ────────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '1rem 1.25rem',
          borderRadius: '10px',
          background: 'rgba(34,197,94,0.06)',
          border: '1px solid rgba(34,197,94,0.2)',
          fontSize: '0.76rem',
          color: 'var(--muted)',
          lineHeight: 1.6,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#22c55e' }}>
          {t('pages.projectGroups.infoTitle')}
        </div>
        <p style={{ margin: '0 0 0.75rem', lineHeight: 1.6 }}>
          {t('pages.projectGroups.infoText1')}
        </p>
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
          <li style={{ marginBottom: '0.25rem' }}>{t('pages.projectGroups.infoItem1')}</li>
          <li style={{ marginBottom: '0.25rem' }}>{t('pages.projectGroups.infoItem2')}</li>
          <li>{t('pages.projectGroups.infoItem3')}</li>
        </ul>
      </div>
    </div>
  )
}

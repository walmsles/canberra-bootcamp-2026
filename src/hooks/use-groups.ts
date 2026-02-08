import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from '../lib/amplify-client'
import type { Schema } from '../../amplify/data/resource'
import { listKeys } from './use-lists'

type ListGroup = Schema['ListGroup']['type']
type GroupInvitation = Schema['GroupInvitation']['type']
type CreateGroupInput = Omit<Schema['ListGroup']['createType'], 'id' | 'createdAt' | 'updatedAt'>
type UpdateGroupInput = Schema['ListGroup']['updateType']
type CreateInvitationInput = Omit<Schema['GroupInvitation']['createType'], 'id' | 'createdAt' | 'updatedAt'>

// Query keys factory
export const groupKeys = {
  all: ['groups'] as const,
  byOwner: (owner: string) => [...groupKeys.all, 'owner', owner] as const,
  detail: (id: string) => [...groupKeys.all, 'detail', id] as const,
  memberOf: (userId: string) => [...groupKeys.all, 'memberOf', userId] as const,
}

export const invitationKeys = {
  all: ['invitations'] as const,
  byGroup: (groupId: string) => [...invitationKeys.all, 'group', groupId] as const,
  byEmail: (email: string) => [...invitationKeys.all, 'email', email] as const,
  byUser: (userId: string) => [...invitationKeys.all, 'user', userId] as const,
}

// Fetch all groups owned by the current user
export function useOwnedGroups(owner: string) {
  return useQuery({
    queryKey: groupKeys.byOwner(owner),
    queryFn: async () => {
      const { data, errors } = await client.models.ListGroup.list()
      if (errors) throw new Error(errors[0].message)
      // Filter to only groups owned by this user
      return data.filter((group) => group.owner === owner)
    },
    enabled: !!owner,
  })
}

// Fetch all groups where user is a member (not owner)
export function useMemberGroups(userId: string) {
  return useQuery({
    queryKey: groupKeys.memberOf(userId),
    queryFn: async () => {
      const { data, errors } = await client.models.ListGroup.list()
      if (errors) throw new Error(errors[0].message)
      // Filter groups where user is in memberIds but not the owner
      return data.filter(
        (group) => group.memberIds?.includes(userId) && group.owner !== userId
      )
    },
    enabled: !!userId,
  })
}


// Fetch a single group by ID
export function useGroup(id: string) {
  return useQuery({
    queryKey: groupKeys.detail(id),
    queryFn: async () => {
      const { data, errors } = await client.models.ListGroup.get({ id })
      if (errors) throw new Error(errors[0].message)
      return data
    },
    enabled: !!id,
  })
}

// Create group mutation
// Requirements: 7.1
export function useCreateGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateGroupInput & { ownerEmail?: string }) => {
      // Validate name is not empty or whitespace
      if (!input.name || input.name.trim() === '') {
        throw new Error('Group name cannot be empty')
      }

      const { data, errors } = await client.models.ListGroup.create({
        name: input.name.trim(),
        description: input.description,
        ownerEmail: input.ownerEmail,
        memberIds: input.memberIds ?? [],
      })
      if (errors) throw new Error(errors[0].message)
      return data
    },
    onSuccess: (data) => {
      if (data?.owner) {
        queryClient.invalidateQueries({ queryKey: groupKeys.byOwner(data.owner) })
      }
    },
  })
}

// Update group mutation
export function useUpdateGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateGroupInput & { id: string }) => {
      // Validate name if provided
      if (input.name !== undefined && (!input.name || input.name.trim() === '')) {
        throw new Error('Group name cannot be empty')
      }

      const updateData = {
        ...input,
        name: input.name?.trim(),
      }

      const { data, errors } = await client.models.ListGroup.update(updateData)
      if (errors) throw new Error(errors[0].message)
      return data
    },
    onSuccess: (data) => {
      if (data?.owner) {
        queryClient.invalidateQueries({ queryKey: groupKeys.byOwner(data.owner) })
      }
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: groupKeys.detail(data.id) })
      }
    },
  })
}

// Delete group mutation
// Requirements: 7.6
export function useDeleteGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, owner }: { id: string; owner: string }) => {
      // First, unshare all lists in this group
      const { data: lists, errors: listErrors } = await client.models.TodoList.list({
        filter: { groupId: { eq: id } },
      })
      if (listErrors) throw new Error(listErrors[0].message)

      // Remove groupId from all lists
      if (lists && lists.length > 0) {
        await Promise.all(
          lists.map(async (list) => {
            const { errors } = await client.models.TodoList.update({
              id: list.id,
              groupId: null,
            })
            if (errors) throw new Error(errors[0].message)
          })
        )
      }

      // Delete all invitations for this group
      const { data: invitations, errors: inviteErrors } = await client.models.GroupInvitation.list({
        filter: { groupId: { eq: id } },
      })
      if (inviteErrors) throw new Error(inviteErrors[0].message)

      if (invitations && invitations.length > 0) {
        await Promise.all(
          invitations.map(async (invite) => {
            const { errors } = await client.models.GroupInvitation.delete({ id: invite.id })
            if (errors) throw new Error(errors[0].message)
          })
        )
      }

      // Then delete the group itself
      const { errors } = await client.models.ListGroup.delete({ id })
      if (errors) throw new Error(errors[0].message)
      return { id, owner }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.byOwner(data.owner) })
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(data.id) })
      queryClient.invalidateQueries({ queryKey: invitationKeys.byGroup(data.id) })
      queryClient.invalidateQueries({ queryKey: listKeys.all })
    },
  })
}


// Invite member to group
// Requirements: 7.2
export function useInviteMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateInvitationInput) => {
      // Validate email is not empty
      if (!input.invitedEmail || input.invitedEmail.trim() === '') {
        throw new Error('Email cannot be empty')
      }

      const { data, errors } = await client.models.GroupInvitation.create({
        groupId: input.groupId,
        groupName: input.groupName,
        invitedEmail: input.invitedEmail.trim().toLowerCase(),
        invitedBy: input.invitedBy,
        status: 'PENDING',
      })
      if (errors) throw new Error(errors[0].message)
      return data
    },
    onSuccess: (data) => {
      if (data?.groupId) {
        queryClient.invalidateQueries({ queryKey: invitationKeys.byGroup(data.groupId) })
      }
    },
  })
}

// Accept invitation using custom atomic mutation
// Requirements: 7.2
export function useAcceptInvitation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ invitationId, groupId, userId, userEmail }: { 
      invitationId: string
      groupId: string
      userId: string
      userEmail: string 
    }) => {
      // Use the custom mutation that atomically appends to memberIds
      const { data, errors } = await client.mutations.acceptGroupInvitation({
        invitationId,
        groupId,
        userId,
        userEmail,
      })
      
      if (errors) throw new Error(errors[0].message)
      if (!data?.success) throw new Error(data?.message ?? 'Failed to accept invitation')
      
      return { groupId: data.groupId }
    },
    onSuccess: (data) => {
      if (data?.groupId) {
        queryClient.invalidateQueries({ queryKey: groupKeys.detail(data.groupId) })
        queryClient.invalidateQueries({ queryKey: invitationKeys.byGroup(data.groupId) })
      }
      queryClient.invalidateQueries({ queryKey: groupKeys.all })
      queryClient.invalidateQueries({ queryKey: invitationKeys.all })
    },
  })
}

// Decline invitation
export function useDeclineInvitation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ invitationId }: { invitationId: string }) => {
      const { data: invitation, errors: getErrors } = await client.models.GroupInvitation.get({
        id: invitationId,
      })
      if (getErrors) throw new Error(getErrors[0].message)
      if (!invitation) throw new Error('Invitation not found')

      const { data, errors } = await client.models.GroupInvitation.update({
        id: invitationId,
        status: 'DECLINED',
      })
      if (errors) throw new Error(errors[0].message)
      return { invitation: data, groupId: invitation.groupId }
    },
    onSuccess: (data) => {
      if (data?.groupId) {
        queryClient.invalidateQueries({ queryKey: invitationKeys.byGroup(data.groupId) })
      }
      queryClient.invalidateQueries({ queryKey: invitationKeys.all })
    },
  })
}

// Revoke member access from group
// Requirements: 7.3
export function useRevokeMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      groupId,
      memberId,
      currentUserId,
    }: {
      groupId: string
      memberId: string
      currentUserId: string
    }) => {
      // Get the group
      const { data: group, errors: getErrors } = await client.models.ListGroup.get({ id: groupId })
      if (getErrors) throw new Error(getErrors[0].message)
      if (!group) throw new Error('Group not found')

      // Check if current user is the owner
      if (group.owner !== currentUserId) {
        throw new Error('Only the group owner can revoke members')
      }

      // Cannot remove the owner
      if (memberId === group.owner) {
        throw new Error('Cannot remove the group owner')
      }

      // Remove member from memberIds
      const currentMembers = group.memberIds ?? []
      const updatedMembers = currentMembers.filter((id) => id !== memberId)

      const { data, errors } = await client.models.ListGroup.update({
        id: groupId,
        memberIds: updatedMembers,
      })
      if (errors) throw new Error(errors[0].message)
      return data
    },
    onSuccess: (data) => {
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: groupKeys.detail(data.id) })
      }
      if (data?.owner) {
        queryClient.invalidateQueries({ queryKey: groupKeys.byOwner(data.owner) })
      }
      queryClient.invalidateQueries({ queryKey: groupKeys.all })
    },
  })
}
// Leave group (for members to remove themselves)
// Requirements: 7.3
export function useLeaveGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      groupId,
      userId,
    }: {
      groupId: string
      userId: string
    }) => {
      // Get the group
      const { data: group, errors: getErrors } = await client.models.ListGroup.get({ id: groupId })
      if (getErrors) throw new Error(getErrors[0].message)
      if (!group) throw new Error('Group not found')

      // Cannot leave if you're the owner
      if (group.owner === userId) {
        throw new Error('Group owner cannot leave. Delete the group instead.')
      }

      // Remove user from memberIds and memberEmails
      const currentMembers = group.memberIds ?? []
      const currentEmails = group.memberEmails ?? []
      const memberIndex = currentMembers.indexOf(userId)

      const updatedMembers = currentMembers.filter((id) => id !== userId)
      const updatedEmails = currentEmails.filter((_, index) => index !== memberIndex)

      const { data, errors } = await client.models.ListGroup.update({
        id: groupId,
        memberIds: updatedMembers,
        memberEmails: updatedEmails,
      })
      if (errors) throw new Error(errors[0].message)
      return { group: data, userId }
    },
    onSuccess: (data) => {
      if (data?.group?.id) {
        queryClient.invalidateQueries({ queryKey: groupKeys.detail(data.group.id) })
      }
      queryClient.invalidateQueries({ queryKey: groupKeys.all })
      queryClient.invalidateQueries({ queryKey: groupKeys.memberOf(data.userId) })
    },
  })
}



// Fetch invitations for a group
export function useGroupInvitations(groupId: string) {
  return useQuery({
    queryKey: invitationKeys.byGroup(groupId),
    queryFn: async () => {
      const { data, errors } = await client.models.GroupInvitation.list({
        filter: { groupId: { eq: groupId } },
      })
      if (errors) throw new Error(errors[0].message)
      return data
    },
    enabled: !!groupId,
  })
}

// Fetch pending invitations for a user by email
export function usePendingInvitations(email: string) {
  return useQuery({
    queryKey: invitationKeys.byEmail(email),
    queryFn: async () => {
      const { data, errors } = await client.models.GroupInvitation.list({
        filter: {
          invitedEmail: { eq: email.toLowerCase() },
          status: { eq: 'PENDING' },
        },
      })
      if (errors) throw new Error(errors[0].message)
      return data
    },
    enabled: !!email,
  })
}

export type { ListGroup, GroupInvitation, CreateGroupInput, UpdateGroupInput, CreateInvitationInput }

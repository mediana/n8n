/* eslint-disable import/no-cycle */
import { Db } from '..';
import { CredentialsService } from './credentials.service';
import { RoleService } from '../role/role.service';

import type { CredentialsEntity } from '../databases/entities/CredentialsEntity';
import type { SharedCredentials } from '../databases/entities/SharedCredentials';
import type { User } from '../databases/entities/User';

export class EECredentialsService extends CredentialsService {
	static async isOwned(
		user: User,
		credentialId: string,
	): Promise<{ ownsCredential: boolean; credential?: CredentialsEntity }> {
		const sharing = await this.getSharing(user, credentialId, ['credentials'], {
			allowGlobalOwner: false,
		});

		if (!sharing) return { ownsCredential: false };

		const { credentials: credential } = sharing;

		return { ownsCredential: true, credential };
	}

	static async share(credential: CredentialsEntity, sharee: User): Promise<SharedCredentials> {
		const role = await RoleService.get({ scope: 'credential', name: 'editor' });

		return Db.collections.SharedCredentials.save({
			credentials: credential,
			user: sharee,
			role,
		});
	}

	static async unshare(credentialId: string, shareeId: string): Promise<void> {
		return Db.collections.SharedCredentials.delete({
			credentials: { id: credentialId },
			user: { id: shareeId },
		});
	}
}
import { prisma } from "@/lib/prisma";

interface KeycloakProfileFields {
    name?: string;
    preferred_username?: string;
}

export async function ensureUserExists(
    userId: string,
    payload?: KeycloakProfileFields,
): Promise<void> {
    if (payload) {
        const profile = {
            name: payload.name ?? "",
            username: payload.preferred_username ?? "",
        };
        await prisma.user.upsert({
            where: { id: userId },
            update: profile,
            create: { id: userId, ...profile },
        });
        return;
    }
    await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: { id: userId },
    });
}

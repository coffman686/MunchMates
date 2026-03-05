// UserSearch.tsx
// Debounced user search input for inviting members to shared collections
// Queries /api/users/search and displays selectable results dropdown

"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { authedFetch } from "@/lib/authedFetch";

export interface UserResult {
    id: string;
    name: string;
    username: string;
}

interface UserSearchProps {
    onSelect: (user: UserResult) => void;
    selectedUser: UserResult | null;
    onClear: () => void;
}

export default function UserSearch({ onSelect, selectedUser, onClear }: UserSearchProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<UserResult[]>([]);
    const [isFocused, setIsFocused] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (query.trim().length < 2) {
            setResults([]);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            setIsLoading(true);
            try {
                const res = await authedFetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`);
                if (res.ok) {
                    const data = await res.json();
                    setResults(data.users);
                }
            } catch {
                setResults([]);
            } finally {
                setIsLoading(false);
            }
        }, 300);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query]);

    if (selectedUser) {
        return (
            <div className="flex items-center gap-2 rounded-xl border px-3 py-2 bg-muted/50">
                <span className="text-sm flex-1">
                    {selectedUser.name || selectedUser.username}
                    {selectedUser.name && selectedUser.username && (
                        <span className="text-muted-foreground ml-1">@{selectedUser.username}</span>
                    )}
                </span>
                <button
                    type="button"
                    onClick={onClear}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        );
    }

    return (
        <div className="relative">
            <Input
                type="text"
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 150)}
                placeholder="Search by name or username..."
                className="rounded-xl"
            />
            {isFocused && query.trim().length >= 2 && (
                <ul className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border bg-popover shadow-md max-h-[200px] overflow-y-auto">
                    {isLoading ? (
                        <li className="px-3 py-2 text-sm text-muted-foreground">Searching...</li>
                    ) : results.length === 0 ? (
                        <li className="px-3 py-2 text-sm text-muted-foreground">No users found</li>
                    ) : (
                        results.map((user) => (
                            <li
                                key={user.id}
                                className="px-3 py-2 text-sm hover:bg-accent cursor-pointer transition-colors"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    onSelect(user);
                                    setQuery("");
                                    setResults([]);
                                    setIsFocused(false);
                                }}
                            >
                                <span className="font-medium">{user.name || user.username}</span>
                                {user.name && user.username && (
                                    <span className="text-muted-foreground ml-1">@{user.username}</span>
                                )}
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
}

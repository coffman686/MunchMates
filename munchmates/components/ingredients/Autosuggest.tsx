// Autosuggest.tsx
// Provides input field with autosuggestion dropdown
// Inputs:
// - data: list of suggestion strings
// - query / setQuery: controlled input state
// - onSelect: optional callback when an item is picked

import { useState, useEffect, useRef } from 'react';
import { Input } from '../ui/input';
import { X } from 'lucide-react';

export default function Autosuggest({ data, query, setQuery, onSelect }: { data: string[], query: string, setQuery: (query: string) => void, onSelect?: (item: string) => void }) {
    const [filteredData, setFilteredData] = useState<string[]>([]);
    const [isFocused, setIsFocused] = useState(false);
    const [background, setBackground] = useState('');
    const didMount = useRef(false);

    useEffect(() => {
        if (!didMount.current) {
            didMount.current = true;
            setBackground(getComputedStyle(document.body).backgroundColor);
        }
    }, []);

    useEffect(() => {
        // filter items based on search query
        if (query === '') {
            setFilteredData([]);
        } else {
            const lowerQuery = query.toLowerCase();
            setFilteredData(data.filter(item => item.toLowerCase().includes(lowerQuery)));
        }
    }, [query, data]);

    return (
        <div className="relative">
            <Input
                type="text"
                id="ingredient-autosuggest"
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 100)}
                placeholder="Enter ingredient..."
                className="pr-9"
            />
            {query && (
                <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); setQuery(''); setFilteredData([]); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
            {filteredData.length > 0 && isFocused && (
                <ul
                    className="absolute top-full left-0 right-0 border border-border rounded-md bg-popover z-[1000] max-h-[150px] overflow-y-auto list-none m-0 p-0"
                >
                    {filteredData.map((item) => (
                        <li
                            key={item}
                            className="hover:bg-accent transition-colors px-2 py-2 border-b border-border/50 cursor-pointer"
                            onMouseDown={(e) => {
                                e.preventDefault(); // Prevent blur from firing
                                if (onSelect) {
                                    onSelect(item);
                                } else {
                                    setQuery(item);
                                    setIsFocused(false);
                                }
                                setFilteredData([]);
                            }}
                        >
                            {item}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

import Link from "next/link";
import { useState } from "react";
import { buildCategoryHref } from "../lib/categoryLinks";

function CategoryNode({ node, sectionKey }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <li className="category-node">
      <div className="category-row">
        {hasChildren ? (
          <button
            className="toggle"
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Свернуть" : "Развернуть"}
          >
            {expanded ? "−" : "+"}
          </button>
        ) : (
          <span className="toggle-placeholder" />
        )}
        <Link href={buildCategoryHref(node.slug, sectionKey)} className="category-link">
          {node.name_ru}
        </Link>
      </div>

      {hasChildren && expanded ? (
        <ul className="category-list nested">
          {node.children.map((child) => (
            <CategoryNode key={child.id} node={child} sectionKey={sectionKey} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function CategoryTree({ categories = [], sectionKey = "services" }) {
  return (
    <nav aria-label="Категории услуг">
      <ul className="category-list">
        {categories.map((category) => (
          <CategoryNode key={category.id} node={category} sectionKey={sectionKey} />
        ))}
      </ul>
    </nav>
  );
}

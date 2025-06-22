import ReactMarkdown from "react-markdown";

type TreeNode = {
  type: string;
  value?: string;
  children?: TreeNode[];
  parent?: TreeNode;
  tagName?: string;
  properties?: any;
  url?: string;
};

type NodeProcessor = (node: TreeNode, nodesToReplace: { node: TreeNode; newChildren: TreeNode[] }[]) => void;

const createTreeWalker = (processNode: NodeProcessor) => {
  return (tree: TreeNode) => {
    const nodesToReplace: { node: TreeNode; newChildren: TreeNode[] }[] = [];

    const walk = (node: TreeNode): void => {
      processNode(node, nodesToReplace);

      if (node.children) {
        for (const child of node.children) {
          child.parent = node;
          walk(child);
        }
      }
    };

    walk(tree);

    nodesToReplace.forEach(({ node, newChildren }) => {
      if (node.parent?.children) {
        const nodeIndex = node.parent.children.indexOf(node);
        node.parent.children.splice(nodeIndex, 1, ...newChildren);
      }
    });
  };
};

const rehypeAddWbrAfterSlash = () => {
  return createTreeWalker((node, nodesToReplace) => {
    if (node.type === "text" && node.value && typeof node.value === "string" && node.value.includes("/")) {
      const parts = node.value.split(/(\/{1,})/);
      if (parts.length > 1) {
        const newChildren: TreeNode[] = [];
        parts.forEach((part: string) => {
          if (/^\/{1,}$/.test(part)) {
            newChildren.push({ type: "text", value: part });
            newChildren.push({ type: "element", tagName: "wbr", properties: {}, children: [] });
          } else if (part) {
            newChildren.push({ type: "text", value: part });
          }
        });

        nodesToReplace.push({ node, newChildren });
      }
    }
  });
};

const remarkAutolink = () => {
  const isInsideLink = (node: TreeNode): boolean => {
    let parent = node.parent;
    while (parent) {
      if (parent.type === "link") {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  };

  return createTreeWalker((node, nodesToReplace) => {
    if (node.type === "text" && node.value && typeof node.value === "string" && !isInsideLink(node)) {
      const urlRegex = /(https?:\/\/[^\s<>"\[\]{}|\\^`]+?)(?=[.,;:!?)\]}]*(?:\s|$))/gi;
      const matches = Array.from(node.value.matchAll(urlRegex));

      if (matches.length > 0) {
        const newChildren: TreeNode[] = [];
        let lastIndex = 0;

        matches.forEach((match: unknown) => {
          const regexMatch = match as RegExpMatchArray;
          const url = regexMatch[1];
          if (!url || regexMatch.index === undefined) return;

          const matchStart = regexMatch.index;
          const matchEnd = matchStart + url.length;

          if (lastIndex < matchStart) {
            newChildren.push({
              type: "text",
              value: node.value.slice(lastIndex, matchStart),
            });
          }

          newChildren.push({
            type: "link",
            url,
            children: [{ type: "text", value: url }],
          });

          lastIndex = matchEnd;
        });

        if (lastIndex < node.value.length) {
          newChildren.push({
            type: "text",
            value: node.value.slice(lastIndex),
          });
        }

        if (newChildren.length > 0) {
          nodesToReplace.push({ node, newChildren });
        }
      }
    }
  });
};

interface MessageMarkdownProps {
  children: string | null;
  className?: string;
  components?: any;
}

export default function MessageMarkdown({ children, className, components }: MessageMarkdownProps) {
  if (!children) return null;

  return (
    <ReactMarkdown
      remarkPlugins={[remarkAutolink]}
      rehypePlugins={[rehypeAddWbrAfterSlash]}
      components={components}
      className={className}
    >
      {children}
    </ReactMarkdown>
  );
}
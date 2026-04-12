import json
from pathlib import Path

import pytest
from docx import Document

from socialsim4.xihu_round1 import (
    ARM_LABELS,
    _extract_material_text,
    enrich_xihu_simulation_payload,
    normalize_xihu_arm_id,
)


def _write_test_package(root) -> None:
    package_dir = root / "round1"
    package_dir.mkdir(parents=True, exist_ok=True)
    package = {
        "packageId": "round1",
        "title": "西湖益联保第一轮干预材料",
        "materials": [
            {
                "id": "A0-material",
                "armId": "A0",
                "armLabel": ARM_LABELS["A0"],
                "kind": "intervention_pdf",
                "kindLabel": "干预材料",
                "filename": "a0.pdf",
                "displayTitle": "A0 控制组材料",
                "storageRef": "materials/A0/a0.pdf",
                "textSummary": "控制组不提供额外材料。",
                "textContent": "控制组材料",
            },
            {
                "id": "A2-material",
                "armId": "A2",
                "armLabel": ARM_LABELS["A2"],
                "kind": "intervention_pdf",
                "kindLabel": "干预材料",
                "filename": "a2.pdf",
                "displayTitle": "A2 简明图文材料",
                "storageRef": "materials/A2/a2.pdf",
                "textSummary": "简明图文突出投保门槛和赔付亮点。",
                "textContent": "A2 材料",
            },
            {
                "id": "A7-material-1",
                "armId": "A7",
                "armLabel": ARM_LABELS["A7"],
                "kind": "intervention_pdf",
                "kindLabel": "干预材料",
                "filename": "a7-negative.pdf",
                "displayTitle": "A7 竞品负面材料",
                "storageRef": "materials/A7/a7-negative.pdf",
                "textSummary": "先呈现竞品负面信息。",
                "textContent": "A7 负面材料",
            },
            {
                "id": "A7-material-2",
                "armId": "A7",
                "armLabel": ARM_LABELS["A7"],
                "kind": "intervention_pdf",
                "kindLabel": "干预材料",
                "filename": "a7-positive.pdf",
                "displayTitle": "A7 官方正面材料",
                "storageRef": "materials/A7/a7-positive.pdf",
                "textSummary": "再呈现西湖益联保官方正面信息。",
                "textContent": "A7 正面材料",
            },
        ],
        "benchmarks": {
            "A0": {
                "armId": "A0",
                "armLabel": ARM_LABELS["A0"],
                "sampleSize": 69,
                "metrics": {
                    "self_enrollment_willingness": {
                        "label": "为自己投保意愿",
                        "mean": 2.58,
                    }
                },
            },
            "A2": {
                "armId": "A2",
                "armLabel": ARM_LABELS["A2"],
                "sampleSize": 61,
                "metrics": {
                    "self_enrollment_willingness": {
                        "label": "为自己投保意愿",
                        "mean": 2.39,
                    }
                },
            },
            "A7": {
                "armId": "A7",
                "armLabel": ARM_LABELS["A7"],
                "sampleSize": 46,
                "metrics": {
                    "self_enrollment_willingness": {
                        "label": "为自己投保意愿",
                        "mean": 2.52,
                    }
                },
            },
        },
        "sourceMeta": {
            "sourceRoot": "test-source",
        },
    }
    (package_dir / "package.json").write_text(
        json.dumps(package, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


@pytest.fixture
def xihu_package_root(monkeypatch):
    package_root = Path("test_results/xihu_package_fixture")
    if package_root.exists():
        for path in sorted(package_root.rglob("*"), reverse=True):
            if path.is_file():
                path.unlink()
            else:
                path.rmdir()
    _write_test_package(package_root)
    monkeypatch.setattr("socialsim4.xihu_round1.XIHU_PACKAGE_ROOT", package_root)
    return package_root


@pytest.mark.parametrize(
    ("arm_value", "expected_arm", "expected_materials"),
    [
        ("A2 简明图文", "A2", 1),
        ("A0 控制组", "A0", 1),
        ("A7 竞品负面+官方正面", "A7", 2),
    ],
)
def test_enrich_xihu_simulation_payload_normalizes_arm_labels(
    xihu_package_root,
    arm_value,
    expected_arm,
    expected_materials,
):
    scene_config = {
        "scenario_id": "xihu_yilianbao",
        "parameters": {
            "intervention_arm": arm_value,
            "decision_focus": "家庭统筹",
        },
    }
    agent_config = {
        "agents": [
            {
                "name": "社区网格员 林岚",
                "knowledgeBase": [{"id": "existing", "title": "已有知识", "content": "existing"}],
            }
        ]
    }

    enriched_scene_config, enriched_agent_config = enrich_xihu_simulation_payload(
        "experiment_template",
        scene_config,
        agent_config,
    )

    assert normalize_xihu_arm_id(arm_value) == expected_arm
    assert enriched_scene_config["parameters"]["intervention_arm"] == expected_arm
    assert enriched_scene_config["xihu_arm_id"] == expected_arm
    assert enriched_scene_config["xihu_arm_label"] == ARM_LABELS[expected_arm]
    assert len(enriched_scene_config["xihu_material_refs"]) == expected_materials
    assert enriched_scene_config["xihu_benchmarks"]["sampleSize"] > 0
    assert enriched_scene_config["xihu_package_id"] == "round1"

    knowledge_base = enriched_agent_config["agents"][0]["knowledgeBase"]
    assert knowledge_base[0]["id"] == "existing"
    assert any(item["id"].startswith("xihu-round1-") for item in knowledge_base[1:])


def test_extract_material_text_allows_empty_docx_for_shared_material_import() -> None:
    fixture_dir = Path("test_results/xihu_docx_fixture")
    if fixture_dir.exists():
        for path in sorted(fixture_dir.rglob("*"), reverse=True):
            if path.is_file():
                path.unlink()
            else:
                path.rmdir()
    fixture_dir.mkdir(parents=True, exist_ok=True)

    empty_docx = fixture_dir / "empty.docx"
    document = Document()
    document.save(empty_docx)

    assert _extract_material_text(empty_docx) == ""
